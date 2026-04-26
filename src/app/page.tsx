'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { scrapeAndSync } from './actions/scrape';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { LogOut, Play, RefreshCw, Settings, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [months, setMonths] = useState(3);
  
  const [url, setUrl] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchData();
  }, [months]);

  const fetchData = async () => {
    setLoading(true);
    const dateLimit = new Date();
    dateLimit.setMonth(dateLimit.getMonth() - months);
    const limitDateStr = dateLimit.toISOString().split('T')[0];

    const storedData = localStorage.getItem('polls');
    let polls = storedData ? JSON.parse(storedData) : [];

    polls = polls.filter((poll: any) => poll.poll_date >= limitDateStr);
    polls.sort((a: any, b: any) => new Date(a.poll_date).getTime() - new Date(b.poll_date).getTime());

    // Transform data for Recharts
    const chartData = polls.map((poll: any) => ({
      name: poll.poll_date,
      '대통령 지지율': poll.president_approval,
      '국민의힘': poll.party_approval?.['국민의힘'] || 0,
      '더불어민주당': poll.party_approval?.['더불어민주당'] || 0,
    }));
    setData(chartData);
    setLoading(false);
  };

  const handleLogout = () => {
    document.cookie = 'auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  const handleScrape = async () => {
    if ((!url && !file) || !geminiKey) {
      alert('데이터 소스(URL 또는 파일)와 Gemini API Key를 입력해주세요.');
      return;
    }
    setScraping(true);

    let base64Data = undefined;
    let mimeType = undefined;

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Data = buffer.toString('base64');
      mimeType = file.type;
    }

    const result = await scrapeAndSync(url, geminiKey, base64Data, mimeType);
    if (result.success && result.data) {
      const storedData = localStorage.getItem('polls');
      let polls = storedData ? JSON.parse(storedData) : [];
      
      // 중복 체크 로직 추가 (날짜와 기관이 같으면 덮어쓰기)
      const existingIndex = polls.findIndex(
        (p: any) => p.poll_date === result.data.poll_date && p.agency === result.data.agency
      );
      
      if (existingIndex >= 0) {
        polls[existingIndex] = result.data;
      } else {
        polls.push(result.data);
      }
      
      localStorage.setItem('polls', JSON.stringify(polls));
      
      alert('데이터 분석 및 동기화 완료!');
      setFile(null); // Reset file input after success
      fetchData();
    } else {
      alert(`오류 발생: ${result.error}`);
    }
    setScraping(false);
  };

  const handleClearData = () => {
    if (confirm('저장된 모든 여론조사 데이터를 삭제하시겠습니까?')) {
      localStorage.removeItem('polls');
      fetchData();
    }
  };

  return (
    <div className="flex h-screen bg-black text-gray-200 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-yellow-500/20 bg-[#0a0a0a] flex flex-col">
        <div className="p-6 border-b border-yellow-500/20">
          <h2 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
            <Settings className="w-5 h-5" /> Admin Panel
          </h2>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">기간 필터 (개월)</h3>
          <ul className="space-y-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <li key={m}>
                <button
                  onClick={() => setMonths(m)}
                  className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                    months === m
                      ? 'bg-yellow-500/10 text-yellow-500 font-medium border border-yellow-500/30'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                >
                  최근 {m}개월
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 border-t border-yellow-500/20 flex flex-col gap-2">
          <button
            onClick={handleClearData}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-orange-400 hover:bg-orange-400/10 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" /> 데이터 초기화
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-yellow-500/20 bg-[#0a0a0a] p-4 flex flex-col gap-4">
          <div className="flex gap-4 items-center">
            <input
              type="password"
              placeholder="Gemini API Key"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-1/3 rounded-md bg-black border border-gray-800 px-4 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
            />
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="데이터 소스 URL (여론조사 기사 등)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 rounded-md bg-black border border-gray-800 px-4 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
              />
              <span className="text-gray-500 text-sm py-2">또는</span>
              <input
                type="file"
                accept="application/pdf, image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex-1 rounded-md bg-black border border-gray-800 px-4 py-1.5 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-yellow-500/10 file:text-yellow-500 hover:file:bg-yellow-500/20"
              />
            </div>
            <button
              onClick={handleScrape}
              disabled={scraping}
              className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-black transition-all whitespace-nowrap ${
                scraping ? 'bg-yellow-600 cursor-wait' : 'bg-yellow-500 hover:bg-yellow-400'
              }`}
            >
              {scraping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {scraping ? '분석 중...' : '데이터 동기화'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            * 선관위 홈페이지의 여론조사 결과 PDF나 캡처 이미지를 첨부하면 URL보다 훨씬 더 빠르고 정확하게 분석할 수 있습니다.
          </p>
        </header>

        {/* Chart Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-black">
          <div className="bg-[#111] border border-yellow-500/20 rounded-xl p-6 h-full min-h-[500px] flex flex-col shadow-lg shadow-yellow-500/5">
            <h2 className="text-xl font-bold text-yellow-500 mb-6">여론조사 지지율 추이 (최근 {months}개월)</h2>
            
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : data.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                데이터가 없습니다. 상단의 데이터 동기화를 진행해주세요.
              </div>
            ) : (
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#000', 
                        borderColor: '#eab308',
                        color: '#fff',
                        borderRadius: '0.5rem',
                        boxShadow: '0 4px 6px -1px rgba(234, 179, 8, 0.1)'
                      }}
                      itemStyle={{ color: '#eab308' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="대통령 지지율" 
                      stroke="#eab308" 
                      strokeWidth={3}
                      dot={{ fill: '#000', stroke: '#eab308', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#eab308', stroke: '#000' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="국민의힘" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="더불어민주당" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
