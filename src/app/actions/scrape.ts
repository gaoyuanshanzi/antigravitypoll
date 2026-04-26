'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

export async function scrapeAndSync(url: string, geminiKey: string) {
  try {
    // 1. Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`웹페이지 접근 실패: ${response.statusText}`);
    }

    const html = await response.text();

    // 2. Extract text using cheerio
    const $ = cheerio.load(html);
    
    $('script, style, noscript, iframe, img, svg').remove();
    const rawText = $('body').text().replace(/\s+/g, ' ').trim();
    const textSample = rawText.substring(0, 10000); 

    // 3. Process with Gemini AI
    const genAI = new GoogleGenerativeAI(geminiKey.trim());
    
    const prompt = `
      다음 텍스트는 웹페이지에서 추출한 여론조사 데이터 기사 또는 문서입니다.
      이 텍스트에서 여론조사 날짜, 조사 기관명, 대통령 지지율(수치만), 주요 정당 지지율(수치만)을 추출해서 JSON 형태로 반환해주세요.
      반환되는 JSON 형식은 정확히 다음 형식을 따라야 하며 마크다운 코드 블록 없이 순수한 JSON 문자열만 반환하세요.

      {
        "poll_date": "YYYY-MM-DD",
        "agency": "조사 기관명",
        "president_approval": 35.5,
        "party_approval": {
          "국민의힘": 30.5,
          "더불어민주당": 32.1
        }
      }

      텍스트:
      ${textSample}
    `;

    const modelsToTry = [
      'gemini-2.5-flash', 
      'gemini-2.5-pro', 
      'gemini-2.0-flash', 
      'gemini-flash-latest', 
      'gemini-pro-latest', 
      'gemini-1.5-flash', 
      'gemini-1.5-pro', 
      'gemini-pro'
    ];
    let result = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        break; 
      } catch (e: any) {
        lastError = e;
      }
    }

    if (!result) {
      // 에러 원인 파악을 위해 사용 가능한 모델 목록을 직접 조회해봅니다.
      let availableModels = '';
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`);
        if (listRes.ok) {
          const listData = await listRes.json();
          const modelNames = listData.models.map((m: any) => m.name.replace('models/', '')).join(', ');
          availableModels = `(현재 API 키로 사용 가능한 모델: ${modelNames})`;
        } else {
          availableModels = `(모델 목록 조회 실패: ${listRes.status} ${listRes.statusText})`;
        }
      } catch (err) {
        availableModels = '(모델 목록 조회 불가)';
      }
      
      throw new Error(`모든 모델 시도 실패. 입력하신 API 키가 Google AI Studio 키가 맞는지 확인해주세요. ${availableModels} / 마지막 에러: ${lastError?.message}`);
    }

    const responseText = result.response.text().trim();
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(jsonStr);

    return { success: true, data: parsedData };
  } catch (error: any) {
    console.error('Scrape error:', error);
    return { success: false, error: error.message };
  }
}


