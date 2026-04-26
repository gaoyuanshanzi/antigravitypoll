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
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();

    // 2. Extract text using cheerio
    const $ = cheerio.load(html);
    
    // Remove scripts, styles, and other non-content tags
    $('script, style, noscript, iframe, img, svg').remove();
    
    // Get raw text and clean it up a bit (compress whitespaces)
    const rawText = $('body').text().replace(/\s+/g, ' ').trim();
    const textSample = rawText.substring(0, 10000); // Limit context size

    // 3. Process with Gemini AI
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Clean up markdown block if the model returned it despite instructions
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(jsonStr);

    // 4. Return parsed data directly
    return { success: true, data: parsedData };
  } catch (error: any) {
    console.error('Scrape error:', error);
    return { success: false, error: error.message };
  }
}

