import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BookOpen, 
  FlaskConical, 
  Users, 
  Smile, 
  Zap, 
  Wallet, 
  Clock, 
  Calendar, 
  Play, 
  Heart,
  Briefcase, 
  MapPin,
  Coffee,
  Moon,
  Sun,
  ShoppingBag,
  X,
  UserPlus,
  Utensils,
  ChevronRight,
  MessageCircle,
  Save,
  Download,
  Upload,
  AlertTriangle,
  PieChart,
  Cake,
  Gift,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { GameState, Gender, TimeSlot, LogEntry, CharacterStats, Relationship, Message, Wish } from './types';
import { generateTurn, generateEnding, requestBirthdayImage, generateRandomEvent } from './services/geminiService';

// --- Constants & Init ---
const MAX_WEEKS = 10;

const INITIAL_STATS: CharacterStats = {
  academic: 50,
  research: 30, // Software Engineering starts slightly lower, needs grinding
  social: 40,
  mood: 80,
  energy: 100,
  money: 100,
};

// Full character roster
const INITIAL_RELATIONSHIPS: Relationship[] = [
  // Love Interests
  { name: '西海', affinity: 10, status: 'Stranger', description: '经管学院的艺术生，常在三好坞写生' },
  { name: 'Micha', affinity: 10, status: 'Stranger', description: '绩点竞争对手，总是在图书馆抢座' },
  { name: '东海', affinity: 10, status: 'Stranger', description: '研究生学长/学姐，实验室负责人' },
  // Friends
  { name: '王立友', affinity: 40, status: 'Friend', description: '你的室友，深夜代码搭子' },
  { name: '汪明杰', affinity: 40, status: 'Stranger', description: '嘉定图书馆常驻用户' },
  { name: '香宁雨', affinity: 10, status: 'Stranger', description: '吉他社社长，现充代表' },
  { name: '陈垲昕', affinity: 10, status: 'Stranger', description: '智信馆里的科研大神' },
  { name: '唐啸', affinity: 10, status: 'Stranger', description: '校篮球队主力' },
  { name: '方必诚', affinity: 10, status: 'Stranger', description: '在嘉实广场摆摊的创业达人' },
];

const PRESET_ACTIONS = [
  { label: '去上课', type: 'academic', icon: BookOpen, desc: '在济事楼上软工导论。 (+学业)' },
  { label: '图书馆刷题', type: 'academic', icon: MapPin, desc: '去嘉定图书馆复习。 (+学业)' },
  { label: '实验室Coding', type: 'research', icon: FlaskConical, desc: '在智信馆写Bug。 (+科研, -心情)' },
  { label: '健身房', type: 'health', icon: Zap, desc: '健身一下？3公里打卡。 (+体力上限)' },
  { label: '去干饭', type: 'life', icon: Utensils, desc: '北苑还是满天星？' }, 
  { label: '社团活动', type: 'social', icon: Users, desc: '百团大战/社团聚会。 (+社交)' },
  { label: '兼职打工', type: 'work', icon: Briefcase, desc: '赚点生活费。 (需满足条件)' },
  { label: '宿舍躺平', type: 'rest', icon: Smile, desc: '刷剧、打游戏。 (+心情, +体力)' },
];

// Wish Options
const CAREER_WISHES: Wish[] = [
  { id: 'career_offer', type: 'career', label: '大厂Offer收割机', description: '获得令人羡慕的大厂实习Offer', targetValue: 85, isCompleted: false }, // Check Research + Social
  { id: 'career_gpa', type: 'career', label: '满绩卷王', description: '学业绩点达到全专业前 10%', targetValue: 90, isCompleted: false }, // Check Academic
  { id: 'career_money', type: 'career', label: '小富即安', description: '靠自己的双手存款达到 8000 元', targetValue: 8000, isCompleted: false }, // Check Money
];

const LOVE_WISHES: Wish[] = [
  { id: 'love_date', type: 'love', label: '不再孤单', description: '和一个心动的人建立深厚羁绊', targetValue: 60, isCompleted: false }, // Check max affinity
  { id: 'love_popular', type: 'love', label: '万人迷', description: '和至少 3 个人关系达到“朋友”以上', targetValue: 3, isCompleted: false }, // Check friend count
];

const SOCIAL_WISHES: Wish[] = [
  { id: 'social_king', type: 'social', label: '嘉定交际花', description: '社交能力爆表，认识所有人', targetValue: 85, isCompleted: false }, // Check Social
  { id: 'social_party', type: 'social', label: '派对动物', description: '举办一次完美的派对（心情极佳）', targetValue: 95, isCompleted: false }, // Check Mood
];


// --- Main Component ---

const App: React.FC = () => {
  // Setup State
  const [setupStep, setSetupStep] = useState<'gender' | 'wishes' | 'done'>('gender');
  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [endingLoading, setEndingLoading] = useState(false); // Track ending generation loading
  const [birthdayImageLoading, setBirthdayImageLoading] = useState(false); // Track birthday image generation
  const [birthdayImageUrl, setBirthdayImageUrl] = useState<string | null>(null); // Store birthday image URL
  
  // Selected Wishes
  const [selectedWishes, setSelectedWishes] = useState<{career?: Wish, love?: Wish, social?: Wish}>({});

  // Modals
  const [showShop, setShowShop] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [showDining, setShowDining] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [endingStage, setEndingStage] = useState<0 | 1 | 2 | 3>(0); // 0: None, 1: Career, 2: Love, 3: Birthday
  
  // Random Events
  const [showEvent, setShowEvent] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [turnsSinceLastEvent, setTurnsSinceLastEvent] = useState(0);
  const [shouldTriggerEvent, setShouldTriggerEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  
  // Game State
  const playerName = '梁乔';
  const [playerGender, setPlayerGender] = useState<Gender>(Gender.Male);
  
  const [gameState, setGameState] = useState<GameState>({
    playerName: '梁乔',
    gender: Gender.Male,
    week: 1,
    day: 1,
    timeSlot: TimeSlot.Morning,
    stats: { ...INITIAL_STATS },
    lastWeekStats: { ...INITIAL_STATS },
    relationships: [...INITIAL_RELATIONSHIPS],
    messages: [],
    wishes: [],
    history: [],
    isGameOver: false,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState.history]);

  // Check for local save on mount
  useEffect(() => {
    const saved = localStorage.getItem('liangqiao_save');
    if (saved) setHasSave(true);
  }, []);

  // Check for Game Over
  useEffect(() => {
      if (gameState.week > MAX_WEEKS && !gameState.gameEnding && !loading && endingStage === 0) {
          triggerEnding();
      }
  }, [gameState.week, gameState.gameEnding, endingStage]);

  // Generate birthday image when entering stage 3 (birthday)
  useEffect(() => {
    if (endingStage === 3 && gameState.gameEnding && !birthdayImageUrl && !birthdayImageLoading) {
      setBirthdayImageLoading(true);
      requestBirthdayImage(gameState.gameEnding.birthday)
        .then((result) => {
          setBirthdayImageUrl(result.imageUrl);
          setBirthdayImageLoading(false);
        })
        .catch((error) => {
          console.error('Failed to generate birthday image:', error);
          setBirthdayImageLoading(false);
        });
    }
  }, [endingStage, gameState.gameEnding, birthdayImageUrl, birthdayImageLoading]);

  // Handle random event trigger
  useEffect(() => {
    if (shouldTriggerEvent && !showEvent && !eventLoading) {
      setShouldTriggerEvent(false);
      triggerRandomEvent();
    }
  }, [shouldTriggerEvent, showEvent, eventLoading]);

  const updateWishProgress = (state: GameState): Wish[] => {
    return state.wishes.map(wish => {
      if (wish.isCompleted) return wish; // Already done

      let completed = false;
      if (wish.id === 'career_offer') completed = state.stats.research >= 85 && state.stats.social >= 60;
      if (wish.id === 'career_gpa') completed = state.stats.academic >= 90;
      if (wish.id === 'career_money') completed = state.stats.money >= 8000;
      if (wish.id === 'love_date') completed = state.relationships.some(r => r.affinity >= 60);
      if (wish.id === 'love_popular') completed = state.relationships.filter(r => r.affinity >= 50).length >= 3;
      if (wish.id === 'social_king') completed = state.stats.social >= 85;
      if (wish.id === 'social_party') completed = state.stats.mood >= 95;

      return { ...wish, isCompleted: completed };
    });
  };

  const startGame = () => {
    const finalWishes = [selectedWishes.career!, selectedWishes.love!, selectedWishes.social!];
    
    setGameState(prev => ({
      ...prev,
      playerName,
      gender: playerGender,
      wishes: finalWishes,
      history: [{
        id: 'init',
        text: `欢迎来到同济大学嘉定校区，${playerName}！你是软件工程专业的新生。济事楼的代码、满天星的美食、还有未知的邂逅都在等你。这学期共有10周，为了那个完美的结局，出发吧！`,
        type: 'system',
        turn: 0
      }]
    }));
    setHasStarted(true);
    setSetupStep('done');
  };

  const saveGame = () => {
      localStorage.setItem('liangqiao_save', JSON.stringify(gameState));
      setHasSave(true);
      alert('游戏进度已保存！');
  };

  const loadGame = () => {
      const saved = localStorage.getItem('liangqiao_save');
      if (saved) {
          try {
              const loadedState = JSON.parse(saved);
              setGameState(loadedState);
              setHasStarted(true);
              setSetupStep('done');
          } catch (e) {
              alert('存档损坏，无法加载');
          }
      }
  };

  const advanceTime = (currentSlot: TimeSlot): { nextSlot: TimeSlot, newDay: boolean, newWeek: boolean } => {
    let nextSlot = TimeSlot.Morning;
    let newDay = false;
    let newWeek = false;

    if (currentSlot === TimeSlot.Morning) nextSlot = TimeSlot.Afternoon;
    else if (currentSlot === TimeSlot.Afternoon) nextSlot = TimeSlot.Evening;
    else {
      nextSlot = TimeSlot.Morning;
      newDay = true;
    }

    if (newDay && gameState.day >= 7) {
      newWeek = true;
    }

    return { nextSlot, newDay, newWeek };
  };

  const handleAction = async (actionLabel: string, customPrompt?: string) => {
    if (loading || gameState.isGameOver) return;
    
    // Close menus
    setShowJobs(false);
    setShowDining(false);
    setShowInvite(false);

    setLoading(true);

    try {
      const response = await generateTurn(gameState, actionLabel, customPrompt);

      const { nextSlot, newDay, newWeek } = advanceTime(gameState.timeSlot);
      let nextDay = gameState.day;
      let nextWeek = gameState.week;
      
      if (newDay) nextDay = (gameState.day % 7) + 1;
      if (newWeek) nextWeek += 1;

      setGameState(prev => {
        const newStats = { ...prev.stats };
        
        // Apply Stat Changes
        Object.entries(response.statChanges).forEach(([key, val]) => {
            if (val && key in newStats) {
                newStats[key as keyof CharacterStats] = Math.max(0, Math.min(100, newStats[key as keyof CharacterStats] + val));
                if (key === 'money') newStats.money = Math.max(0, prev.stats.money + val);
            }
        });

        // Penalty Check
        let penaltyLog: LogEntry | null = null;
        if (newStats.energy < 10 && !gameState.isGameOver) {
             newStats.energy += 30;
             newStats.mood -= 10;
             newStats.academic -= 5;
             penaltyLog = {
                 id: Date.now().toString() + '_penalty',
                 text: "【警告】由于体力过低，你在回宿舍的路上晕倒了，被迫休息。 (体力 +30, 心情 -10, 学业 -5)",
                 type: 'event',
                 turn: prev.week * 100,
                 feedback: { stats: 'forced rest', time: '紧急休息' }
             };
        }

        // Relationship Updates
        let newRelationships = [...prev.relationships];
        if (response.relationshipUpdates) {
          response.relationshipUpdates.forEach(update => {
            newRelationships = newRelationships.map(r => {
                if (r.name === update.name) {
                    const newAffinity = Math.min(100, Math.max(0, r.affinity + update.change));
                    let newStatus = r.status;
                    if (newAffinity > 20 && r.status === 'Stranger') newStatus = 'Acquaintance';
                    if (newAffinity > 50 && r.status === 'Acquaintance') newStatus = 'Friend';
                    if (newAffinity > 80 && r.status === 'Friend') newStatus = 'Close Friend';
                    return { ...r, affinity: newAffinity, status: newStatus };
                }
                return r;
            });
          });
        }
        
        // SMS Logic
        const newMessages = [...prev.messages];
        if (response.sms) {
            newMessages.push({
                id: Date.now().toString(),
                sender: response.sms.sender,
                content: response.sms.content,
                isRead: false,
                timestamp: `W${prev.week} D${prev.day}`
            });
        }

        // Update Wishes
        const tempStateForWishes = { ...prev, stats: newStats, relationships: newRelationships };
        const updatedWishes = updateWishProgress(tempStateForWishes);

        // Logs
        const newLog: LogEntry = {
          id: Date.now().toString(),
          text: response.narrative,
          type: 'narrative',
          turn: prev.week * 100 + prev.day * 10 + (prev.timeSlot === TimeSlot.Morning ? 1 : prev.timeSlot === TimeSlot.Afternoon ? 2 : 3),
          feedback: {
             stats: '', // handled by raw data logic in render
             time: `[时间流逝] 第${nextWeek}周 星期${nextDay} ${nextSlot === TimeSlot.Morning ? '上午' : nextSlot === TimeSlot.Afternoon ? '下午' : '晚上'}`
          }
        };
        (newLog as any).rawChanges = response.statChanges;
        (newLog as any).rawRelUpdates = response.relationshipUpdates;
        
        const historyUpdate = [...prev.history, newLog];
        if (penaltyLog) historyUpdate.push(penaltyLog);

        // Weekly Report Trigger
        if (nextWeek > prev.week) {
             setTimeout(() => setShowWeeklyReport(true), 800);
        }

        // Random Event Trigger (every 5 turns)
        const newTurnsSinceLastEvent = turnsSinceLastEvent + 1;
        setTurnsSinceLastEvent(newTurnsSinceLastEvent);
        if (newTurnsSinceLastEvent >= 5) {
          setTurnsSinceLastEvent(0);
          setShouldTriggerEvent(true);
        }

        return {
          ...prev,
          week: nextWeek,
          day: nextDay,
          timeSlot: nextSlot,
          stats: newStats,
          lastWeekStats: nextWeek > prev.week ? { ...newStats } : prev.lastWeekStats,
          relationships: newRelationships,
          messages: newMessages,
          wishes: updatedWishes,
          history: historyUpdate,
          isGameOver: newStats.energy < 0 || nextWeek > MAX_WEEKS 
        };
      });

    } catch (e) {
      console.error(e);
      alert("AI 响应超时，正在重试...请检查网络");
    } finally {
      setLoading(false);
    }
  };

  const triggerEnding = async () => {
     setEndingLoading(true); // Set ending loading flag instead of general loading
     try {
       // @ts-ignore - The service now returns an object, not string
       const endingData = await generateEnding(gameState); 
       setGameState(prev => ({...prev, isGameOver: true, gameEnding: endingData}));
       setEndingStage(1); // Start with Career
     } catch (e) {
       console.error(e);
       alert("找不到结局啦，你是不是一口气烧了学校的档案室？");
       setEndingLoading(false); // Reset loading on error
     }
  };

  const triggerRandomEvent = async () => {
    setEventLoading(true);
    setShowEvent(true); // Show loading modal immediately
    setEventError(null);
    try {
      // Add timeout: if event generation takes more than 20 seconds, consider it a failure
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('事件回忆超时（30s）')), 30000)
      );
      const event = await Promise.race([
        generateRandomEvent(gameState),
        timeoutPromise,
      ]);
      setCurrentEvent(event);
      setEventLoading(false);
      setEventError(null);
    } catch (err: any) {
      console.error('Failed to generate random event:', err);
      // Keep modal open, show an error message and allow user to retry or close
      setEventError(err?.message || '事件回忆失败');
      setCurrentEvent(null);
      setEventLoading(false);
    }
  };

  const handleEventChoice = async (choiceId: string) => {
    if (!currentEvent || eventLoading) return; // Prevent multiple clicks

    const choice = currentEvent.choices.find((c: any) => c.id === choiceId);
    if (!choice) return;

    setEventLoading(true); // Disable further interactions

    // Add event outcome to history
    setGameState(prev => {
      const newStats = { ...prev.stats };
      
      // Apply stat changes from choice
      Object.entries(choice.statChanges).forEach(([key, val]) => {
        if (val && key in newStats) {
          newStats[key as keyof CharacterStats] = Math.max(
            0,
            key === 'money' 
              ? Math.max(0, prev.stats.money + (val as number))
              : Math.min(100, newStats[key as keyof CharacterStats] + (val as number))
          );
        }
      });

      // Apply relationship changes if any
      let newRelationships = [...prev.relationships];
      if (choice.relationshipChanges) {
        choice.relationshipChanges.forEach((update: any) => {
          newRelationships = newRelationships.map(r => {
            if (r.name === update.name) {
              const newAffinity = Math.min(100, Math.max(0, r.affinity + update.change));
              let newStatus = r.status;
              if (newAffinity > 20 && r.status === 'Stranger') newStatus = 'Acquaintance';
              if (newAffinity > 50 && r.status === 'Acquaintance') newStatus = 'Friend';
              if (newAffinity > 80 && r.status === 'Friend') newStatus = 'Close Friend';
              return { ...r, affinity: newAffinity, status: newStatus };
            }
            return r;
          });
        });
      }

      // Add event log
      const eventLog: LogEntry = {
        id: Date.now().toString(),
        text: `【随机事件】${currentEvent.title}\n\n${choice.outcome}`,
        type: 'event',
        turn: prev.week * 100 + prev.day * 10,
        feedback: { stats: '', time: `W${prev.week} D${prev.day}` }
      };
      (eventLog as any).rawChanges = choice.statChanges;
      (eventLog as any).rawRelUpdates = choice.relationshipChanges || [];

      // Update wishes
      const tempStateForWishes = { ...prev, stats: newStats, relationships: newRelationships };
      const updatedWishes = updateWishProgress(tempStateForWishes);

      return {
        ...prev,
        stats: newStats,
        relationships: newRelationships,
        wishes: updatedWishes,
        history: [...prev.history, eventLog]
      };
    });

    // Close modal and reset state after a brief delay for UI feedback
    setTimeout(() => {
      setShowEvent(false);
      setCurrentEvent(null);
      setEventLoading(false);
    }, 300);
  };

  // --- UI Components ---
  
  const renderLogFeedback = (entry: LogEntry) => {
      if (!entry.feedback) return null;
      const rawChanges = (entry as any).rawChanges as Partial<CharacterStats>;
      const rawRel = (entry as any).rawRelUpdates as {name: string, change: number}[];
      if (!rawChanges && !rawRel) return <div className="mt-2 text-xs text-slate-400">{entry.feedback.time}</div>;

      return (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
             <div className="mb-2 flex flex-wrap items-center leading-relaxed gap-2">
                 {Object.entries(rawChanges || {}).map(([k, v]) => v !== 0 && (
                   <span key={k} className={`${(v as number)>0?'text-green-600':'text-red-600'} font-medium`}>
                     {k==='academic'?'学业':k==='research'?'科研':k==='social'?'社交':k==='mood'?'心情':k==='energy'?'体力':k==='money'?'金钱':k} {(v as number)>0?'+':''}{v}
                   </span>
                 ))}
                 {rawRel?.map(r => r.change !== 0 && (
                   <span key={r.name} className={`${r.change>0?'text-pink-600':'text-slate-500'} font-medium`}>
                     {r.name}好感 {r.change>0?'+':''}{r.change}
                   </span>
                 ))}
             </div>
             <div className="text-xs text-slate-400 font-mono border-t border-slate-100 pt-2 flex items-center gap-2">
                 <Clock size={12} />
                 {entry.feedback.time}
             </div>
          </div>
      );
  };
  
  // Mark messages as read when viewing a specific sender (simplified: mark all as read when opening modal for now, or per sender)
  // Let's implement per-sender view in the modal.
  const [activeMessageContact, setActiveMessageContact] = useState<string | null>(null);

  const getUnreadCount = () => gameState.messages.filter(m => !m.isRead).length;
  const canSave = gameState.day === 7 && gameState.timeSlot === TimeSlot.Evening;

  // --- Screens ---

  // 1. Setup Screen
  if (setupStep === 'gender') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full animate-fadeIn">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">梁乔的学期</h1>
          <p className="text-slate-500 mb-6">同济大学软工生活模拟器</p>
          <div className="space-y-4">
            <p className="font-medium text-slate-700">请选择你的性别</p>
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => setPlayerGender(Gender.Male)} className={`py-4 rounded-xl border-2 font-bold ${playerGender===Gender.Male?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-500'}`}>男生</button>
               <button onClick={() => setPlayerGender(Gender.Female)} className={`py-4 rounded-xl border-2 font-bold ${playerGender===Gender.Female?'border-pink-500 bg-pink-50 text-pink-700':'border-slate-200 text-slate-500'}`}>女生</button>
            </div>
            <button onClick={() => setSetupStep('wishes')} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold mt-4 flex items-center justify-center gap-2">下一步 <ChevronRight size={18}/></button>
            {hasSave && <button onClick={loadGame} className="w-full bg-white border border-slate-300 text-slate-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Upload size={18}/> 读取存档</button>}
          </div>
        </div>
      </div>
    )
  }

  // 2. Wishes Screen
  if (setupStep === 'wishes') {
     return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-2xl w-full animate-fadeIn h-[85vh] flex flex-col">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">愿望清单</h1>
          <p className="text-slate-500 text-sm mb-4">在这个学期结束时，你希望达成什么成就？（各选一个）</p>
          
          <div className="flex-1 overflow-y-auto space-y-6 custom-scroll pr-2">
            {/* Career */}
            <div>
              <h3 className="flex items-center gap-2 font-bold text-blue-600 mb-2"><Briefcase size={18}/> 职业愿望</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {CAREER_WISHES.map(w => (
                  <button key={w.id} onClick={() => setSelectedWishes(p => ({...p, career: w}))} className={`p-3 rounded-xl border-2 text-left transition-all ${selectedWishes.career?.id===w.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}>
                    <div className="font-bold text-slate-800 text-sm">{w.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{w.description}</div>
                  </button>
                ))}
              </div>
            </div>
            {/* Love */}
            <div>
              <h3 className="flex items-center gap-2 font-bold text-pink-600 mb-2"><Heart size={18}/> 爱情愿望</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {LOVE_WISHES.map(w => (
                  <button key={w.id} onClick={() => setSelectedWishes(p => ({...p, love: w}))} className={`p-3 rounded-xl border-2 text-left transition-all ${selectedWishes.love?.id===w.id ? 'border-pink-500 bg-pink-50' : 'border-slate-100 hover:border-pink-200'}`}>
                    <div className="font-bold text-slate-800 text-sm">{w.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{w.description}</div>
                  </button>
                ))}
              </div>
            </div>
            {/* Social */}
            <div>
              <h3 className="flex items-center gap-2 font-bold text-green-600 mb-2"><Users size={18}/> 社交愿望</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SOCIAL_WISHES.map(w => (
                  <button key={w.id} onClick={() => setSelectedWishes(p => ({...p, social: w}))} className={`p-3 rounded-xl border-2 text-left transition-all ${selectedWishes.social?.id===w.id ? 'border-green-500 bg-green-50' : 'border-slate-100 hover:border-green-200'}`}>
                    <div className="font-bold text-slate-800 text-sm">{w.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{w.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button 
            disabled={!selectedWishes.career || !selectedWishes.love || !selectedWishes.social}
            onClick={startGame} 
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            开启我的大学生活 <Play size={18}/>
          </button>
        </div>
      </div>
     )
  }

  // 3. Ending Loading Screen
  if (endingLoading && !gameState.gameEnding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4 overflow-hidden relative">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>

        <div className="relative z-10 text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-white drop-shadow-lg">学期结束</h1>
            <p className="text-xl text-indigo-200">正在展望你的故事结局...</p>
          </div>

          {/* Loading spinner */}
          <div className="flex justify-center">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-4 border-transparent border-t-indigo-400 rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
              <div className="absolute inset-4 border-4 border-transparent border-t-purple-400 rounded-full animate-spin"></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-lg text-slate-300">正在撰写你的未来...</p>
            <div className="flex gap-2 justify-center">
              <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-3 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <p className="text-sm text-slate-400 mt-4">这可能需要 20-30 秒，请耐心等待...</p>
          </div>

          {/* Summary of journey */}
          <div className="max-w-md mx-auto mt-12 p-6 bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700">
            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-4">本学期成绩回顾</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-300">最终学业</span><span className="font-mono text-white">{gameState.stats.academic}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">最终科研</span><span className="font-mono text-white">{gameState.stats.research}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">最终社交</span><span className="font-mono text-white">{gameState.stats.social}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">最终心情</span><span className="font-mono text-white">{gameState.stats.mood}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">总回合数</span><span className="font-mono text-white">{gameState.history.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">完成愿望</span><span className="font-mono text-white">{gameState.wishes.filter(w => w.isCompleted).length}/3</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Ending Screens (Stages)
  if (gameState.gameEnding && endingStage > 0) {
      const { career, love, birthday } = gameState.gameEnding as any;
      const content = endingStage === 1 ? career : endingStage === 2 ? love : birthday;
      const title = endingStage === 1 ? "职业结局" : endingStage === 2 ? "情感归宿" : "生日快乐";
      const bgColor = endingStage === 1 ? "from-sky-50 via-blue-50 to-indigo-50" : endingStage === 2 ? "from-rose-50 via-pink-50 to-red-50" : "from-amber-50 via-yellow-50 to-orange-50";
      const accentGradient = endingStage === 1 ? "from-sky-300 to-blue-300" : endingStage === 2 ? "from-rose-300 to-pink-300" : "from-amber-300 to-yellow-300";
      const iconBgColor = endingStage === 1 ? "bg-sky-100" : endingStage === 2 ? "bg-rose-100" : "bg-amber-100";
      const textColor = endingStage === 1 ? "text-sky-900" : endingStage === 2 ? "text-rose-900" : "text-amber-900";
      
      return (
          <div className={`h-screen bg-gradient-to-br ${bgColor} overflow-y-auto flex flex-col`}>
              <div className="flex-1 p-6 md:p-12 flex flex-col items-center">&nbsp;&nbsp;
                {/* Stage indicator */}
                <div className="flex justify-center mb-8">
                  <div className="inline-flex gap-2 bg-white/70 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm">
                    {[1, 2, 3].map(stage => (
                      <div
                        key={stage}
                        className={`w-3 h-3 rounded-full transition-all ${
                          stage === endingStage ? `bg-gradient-to-r ${accentGradient} w-8` : stage < endingStage ? 'bg-slate-400' : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Title with warmth */}
                <div className="text-center mb-8 max-w-2xl w-full">
                  <div className={`inline-block ${iconBgColor} p-4 rounded-full mb-4`}>
                    {endingStage === 1 ? <Briefcase size={28} className={textColor} /> : 
                     endingStage === 2 ? <Heart size={28} className={textColor} /> : 
                     <Cake size={28} className={textColor} />}
                  </div>
                  <h1 className={`text-4xl md:text-5xl font-bold ${textColor} mb-2`}>{title}</h1>
                  <p className="text-slate-600 text-sm">你的学期故事在这里继续...</p>
                </div>

                {/* Content card with proper scrolling */}
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/60 p-8 md:p-10 mb-8 max-w-2xl w-full max-h-[45vh] overflow-y-auto">
                    <div className={`prose prose-headings:${textColor} prose-headings:font-bold prose-p:text-slate-700 prose-strong:${textColor} max-w-none`}>
                      <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong class="' + textColor + '">$1</strong>') }} />
                    </div>
                </div>

                {/* Birthday Image Section (only show on stage 3) */}
                {endingStage === 3 && (
                  <div className="mb-8 max-w-2xl w-full">
                    {birthdayImageLoading ? (
                      <div className="w-full bg-white/90 backdrop-blur-sm rounded-2xl border border-white/60 p-8 flex flex-col items-center justify-center min-h-[280px]">
                        <div className="mb-4">
                          <svg className="w-16 h-16 text-amber-400 animate-pulse" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <p className="text-amber-900 font-medium">正在描绘你的生日祝贺画像…</p>
                        <p className="text-slate-500 text-sm mt-2">摄影师正在描绘这特殊的一刻</p>
                      </div>
                    ) : birthdayImageUrl ? (
                      <div className="w-full bg-white/90 backdrop-blur-sm rounded-2xl border border-white/60 p-6 flex flex-col items-center shadow-lg">
                        <img src={birthdayImageUrl} alt="Birthday Ending" className="w-full rounded-xl shadow-md mb-6 max-h-[420px] object-contain" />
                        <div className="flex flex-col gap-3 w-full">
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = birthdayImageUrl;
                              link.download = `birthday_ending_${Date.now()}.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-300 to-yellow-300 hover:from-amber-400 hover:to-yellow-400 text-amber-900 px-6 py-3 rounded-xl font-bold transition-all shadow-md"
                          >
                            <Download size={18} />
                            下载这份祝福
                          </button>
                          <button onClick={() => setBirthdayImageUrl(null)} className="text-sm text-slate-500 hover:text-slate-700 underline">或者换一张预览</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Navigation buttons */}
                <div className="flex justify-center gap-4 mt-8 pb-8">
                    {endingStage < 3 ? (
                        <button onClick={() => {
                          setBirthdayImageUrl(null);
                          setEndingStage(prev => (prev + 1) as any);
                        }} className={`inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r ${accentGradient} ${textColor} font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all`}>
                           下一幕 <ChevronRight size={20} />
                        </button>
                    ) : (
                        <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-slate-600 to-slate-700 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                           🎉 再来一个学期
                        </button>
                    )}
                </div>
              </div>
          </div>
      )
  }

  // 4. Main Game UI
  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-100 overflow-hidden font-sans">
      
      {/* LEFT: Stats & Info */}
      <div className="hidden md:flex w-80 bg-white border-r border-slate-200 flex-col h-full overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white ${playerGender === Gender.Male ? 'bg-blue-500' : 'bg-pink-500'}`}>
              {playerName.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{playerName}</h2>
              <div className="text-xs text-slate-500 font-mono">软工 / 嘉定 ({playerGender === Gender.Male ? '男' : '女'})</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1">
           {/* Date Display */}
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
             <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">学期进度</span>
                <span className="text-xs font-mono text-slate-400">{gameState.week}/{MAX_WEEKS} 周</span>
             </div>
             <div className="flex items-center justify-between text-slate-800">
                <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-blue-500" />
                    <span className="font-medium">第 {gameState.week} 周, 星期{gameState.day}</span>
                </div>
                <div className="flex items-center gap-2">
                    {gameState.timeSlot === TimeSlot.Morning ? <Sun size={18} className="text-amber-500" /> : 
                     gameState.timeSlot === TimeSlot.Afternoon ? <Sun size={18} className="text-orange-500" /> :
                     <Moon size={18} className="text-indigo-500" />}
                    <span className="font-medium">
                        {gameState.timeSlot === TimeSlot.Morning ? '上午' : 
                         gameState.timeSlot === TimeSlot.Afternoon ? '下午' : '晚上'}
                    </span>
                </div>
             </div>
           </div>

           {/* Stats (numeric) */}
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">角色属性</h3>
             <div className="grid grid-cols-2 gap-2 text-sm">
               <div className="flex justify-between"><span>学业</span><span className="font-mono">{gameState.stats.academic}</span></div>
               <div className="flex justify-between"><span>科研</span><span className="font-mono">{gameState.stats.research}</span></div>
               <div className="flex justify-between"><span>社交</span><span className="font-mono">{gameState.stats.social}</span></div>
               <div className="flex justify-between"><span>心情</span><span className="font-mono">{gameState.stats.mood}</span></div>
               <div className="flex justify-between"><span>体力</span><span className="font-mono">{gameState.stats.energy}</span></div>
               <div className="flex justify-between"><span>金钱</span><span className="font-mono">¥{gameState.stats.money}</span></div>
             </div>
           </div>

           {/* Detailed Stats */}
           <div>
             {/* ...existing stats rendering... */}
           </div>

           {/* Relationships Snippet */}
           <div>
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">特别关注</h3>
             <div className="space-y-2">
                {gameState.relationships.filter(r => r.affinity > 40).slice(0, 3).map(rel => (
                    <div key={rel.name} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                        <span>{rel.name}</span>
                        <span className="text-pink-500 font-mono">♥ {rel.affinity}</span>
                    </div>
                ))}
                {gameState.relationships.filter(r => r.affinity > 40).length === 0 && (
                    <div className="text-xs text-slate-400 italic">暂无知心好友</div>
                )}
             </div>
           </div>
        </div>
      </div>

      {/* CENTER/RIGHT: Game Loop */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Mobile Header */}
        <div className="md:hidden bg-white p-4 border-b border-slate-200 flex justify-between items-center z-10">
            <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">{playerName.charAt(0)}</div>
                 <span className="font-bold text-sm">{playerName}</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1"><Zap size={14} className="text-yellow-500"/> {gameState.stats.energy}</span>
                <span className="flex items-center gap-1"><Wallet size={14} className="text-emerald-500"/> {gameState.stats.money}</span>
                <span className="flex items-center gap-1"><Calendar size={14} className="text-blue-500"/> W{gameState.week}</span>
            </div>
        </div>
        
        {/* Narrative Log */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 game-scroll bg-slate-50">
           {gameState.history.map((entry) => (
             <div key={entry.id} className={`flex ${entry.type === 'system' ? 'justify-center' : 'justify-start'} animate-fadeIn`}>
                <div className={`max-w-3xl rounded-xl p-4 shadow-sm w-full ${
                    entry.type === 'system' ? 'bg-slate-200 text-slate-600 text-sm font-medium py-1 px-4 rounded-full w-auto' :
                    entry.type === 'event' ? 'bg-purple-50 border border-purple-100 text-purple-900' :
                    'bg-white border border-slate-200 text-slate-800'
                }`}>
                    {entry.type !== 'system' && <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide">回合 {entry.turn}</div>}
                    <p className="leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                    {renderLogFeedback(entry)}
                </div>
             </div>
           ))}
           {loading && (
             <div className="flex justify-start animate-pulse">
                <div className="bg-white border border-slate-200 text-slate-500 rounded-xl p-4 shadow-sm flex items-center gap-2">
                    <span className="text-xs">正在度过有趣的时刻...</span>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                </div>
             </div>
           )}
        </div>

        {/* Action Panel */}
        <div className="bg-white border-t border-slate-200 p-4 md:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
           <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2">
                    <Clock size={16} /> 
                    {gameState.timeSlot === TimeSlot.Morning ? '上午' : gameState.timeSlot === TimeSlot.Afternoon ? '下午' : '晚上'}安排
                </h3>
                <div className="flex gap-2">
                    <button onClick={() => canSave ? saveGame() : null} disabled={!canSave || loading} className={`p-2 rounded-full transition-colors ${canSave ? 'text-blue-600 bg-blue-50' : 'text-slate-300 bg-slate-50'}`}><Save size={18} /></button>
                    <button onClick={() => {setShowMessages(true); setActiveMessageContact(null)}} className="relative p-2 rounded-full text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors">
                        <MessageCircle size={18} />
                        {getUnreadCount() > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}
                    </button>
                    <button onClick={() => setShowInvite(true)} disabled={loading || gameState.isGameOver} className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm hover:bg-pink-200 transition-colors"><UserPlus size={14} /></button>
                    <button onClick={() => setShowShop(true)} disabled={loading || gameState.isGameOver} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm hover:bg-amber-200 transition-colors"><ShoppingBag size={14} /></button>
                </div>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             {PRESET_ACTIONS.map((action) => (
                <button
                    key={action.label}
                    disabled={loading || gameState.isGameOver || gameState.stats.energy < 10}
                    onClick={() => {
                        if (action.type === 'work') setShowJobs(true);
                        else if (action.type === 'life') setShowDining(true);
                        else handleAction(action.label);
                    }}
                    className="group flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 hover:shadow-md transition-all disabled:opacity-50"
                >
                    <div className={`mb-2 p-2 rounded-full bg-white shadow-sm group-hover:scale-110 transition-transform ${
                        action.type === 'academic' ? 'text-blue-500' :
                        action.type === 'research' ? 'text-purple-500' :
                        action.type === 'social' ? 'text-green-500' :
                        action.type === 'rest' ? 'text-pink-500' :
                        'text-slate-500'
                    }`}>
                        {React.createElement(action.icon, { size: 20 })}
                    </div>
                    <span className="font-medium text-sm text-slate-700">{action.label}</span>
                </button>
             ))}
           </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* SMS MODAL - CONTACTS VIEW */}
      {showMessages && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex h-[70vh]">
                  {/* Sidebar: Contacts */}
                  <div className="w-1/3 border-r border-slate-100 bg-slate-50 overflow-y-auto">
                     <div className="p-4 font-bold text-slate-700 border-b border-slate-100">消息列表</div>
                     {Array.from(new Set(gameState.messages.map(m => m.sender))).map(sender => {
                         const unread = gameState.messages.filter(m => m.sender === sender && !m.isRead).length;
                         const lastMsg = gameState.messages.filter(m => m.sender === sender).pop();
                         return (
                             <div key={sender} 
                                  onClick={() => setActiveMessageContact(sender)}
                                  className={`p-3 cursor-pointer hover:bg-white border-b border-slate-100 ${activeMessageContact === sender ? 'bg-white border-l-4 border-l-blue-500' : ''}`}
                             >
                                 <div className="flex justify-between items-center">
                                     <span className="font-bold text-slate-800 text-sm">{sender}</span>
                                     {unread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{unread}</span>}
                                 </div>
                                 <div className="text-xs text-slate-400 truncate mt-1">{lastMsg?.content}</div>
                             </div>
                         )
                     })}
                     {gameState.messages.length === 0 && <div className="p-4 text-xs text-slate-400 text-center">暂无联系人</div>}
                  </div>

                  {/* Main: Chat */}
                  <div className="w-2/3 flex flex-col bg-white relative">
                      <button onClick={() => setShowMessages(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                      
                      {activeMessageContact ? (
                          <>
                             <div className="p-4 border-b border-slate-100 font-bold text-slate-800">{activeMessageContact}</div>
                             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                 {gameState.messages.filter(m => m.sender === activeMessageContact).map((msg, idx) => (
                                     <div key={idx} className="flex flex-col items-start animate-fadeIn">
                                         <div className="bg-slate-100 p-3 rounded-xl rounded-tl-none text-sm text-slate-700 max-w-[90%]">
                                             {msg.content}
                                         </div>
                                         <span className="text-[10px] text-slate-300 mt-1 ml-1">{msg.timestamp}</span>
                                     </div>
                                 ))}
                             </div>
                             {/* Mark as read effect */}
                             {(() => {
                                 if (gameState.messages.some(m => m.sender === activeMessageContact && !m.isRead)) {
                                     const newMsgs = gameState.messages.map(m => m.sender === activeMessageContact ? {...m, isRead: true} : m);
                                     setTimeout(() => setGameState(prev => ({...prev, messages: newMsgs})), 500);
                                 }
                                 return null;
                             })()}
                          </>
                      ) : (
                          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">选择一个联系人查看消息</div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* WEEKLY REPORT MODAL */}
      {showWeeklyReport && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-bounceIn flex flex-col max-h-[80vh]">
                  <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-center shrink-0">
                      <h2 className="text-2xl font-bold mb-1">周进度报告</h2>
                      <p className="text-indigo-100 text-sm opacity-80">第 {gameState.week - 1} 周总结</p>
                  </div>
                  <div className="p-6 space-y-4 overflow-y-auto custom-scroll">
                      {/* Stats Diff */}
                      <div className="grid grid-cols-2 gap-3">
              {Object.entries(gameState.stats).map(([key, val]) => {
                const diff = Number(val) - (gameState.lastWeekStats[key as keyof CharacterStats] || 0);
                              if (key === 'money' || key === 'energy') return null;
                              const labelMap: any = { academic: '学业', research: '科研', social: '社交', mood: '心情' };
                              return (
                                  <div key={key} className="bg-slate-50 p-2 rounded-lg flex justify-between items-center">
                                      <span className="text-xs text-slate-500">{labelMap[key]}</span>
                                      <div className="flex items-center gap-1">
                                          <span className="font-bold text-slate-800">{val}</span>
                                          {diff !== 0 && <span className={`text-[10px] ${diff > 0 ? 'text-green-500' : 'text-red-500'}`}>{diff > 0 ? '↑' : '↓'}{Math.abs(diff)}</span>}
                                      </div>
                                  </div>
                              )
                          })}
                      </div>

                      {/* Wishes Progress */}
                      <div className="border-t border-slate-100 pt-4">
                          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Cake size={16}/> 愿望进度</h3>
                          <div className="space-y-3">
                              {gameState.wishes.map(wish => (
                                  <div key={wish.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                      <div className="flex justify-between items-center mb-1">
                                          <span className="text-sm font-bold text-slate-700">{wish.label}</span>
                                          {wish.isCompleted 
                                            ? <span className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> 达成</span> 
                                            : <span className="text-xs text-slate-400 flex items-center gap-1"><Circle size={12}/> 进行中</span>
                                          }
                                      </div>
                                      <div className="text-xs text-slate-500">{wish.description}</div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <button onClick={() => setShowWeeklyReport(false)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shrink-0">
                          继续新的一周
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Shop Modal */}
      {showShop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-amber-50">
              <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2"><ShoppingBag className="text-amber-600" /> 商店</h2>
              <button onClick={() => setShowShop(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] bg-slate-50 space-y-3">
              {/* Items */}
              {[
                { id: 'noodle', label: '方便面', cost: 10, effects: { mood: 5, energy: 10 }, desc: '心情 +5，体力 +10' },
                { id: 'coffee', label: '咖啡', cost: 8, effects: { energy: 25, mood: -2 }, desc: '体力 +25，心情 -2' },
                { id: 'book', label: '参考书', cost: 60, effects: { academic: 6 }, desc: '学业 +6' },
                { id: 'energy_drink', label: '能量饮料', cost: 25, effects: { energy: 50, mood: -5 }, desc: '体力 +50，心情 -5' },
                { id: 'sleep_potion', label: '昏睡水', cost: 500, effects: { jumpToLastDay: true }, desc: '我等不及啦！直接推进到学期最后一天（不可逆）' },
              ].map(item => (
                <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-800">{item.label}</div>
                    <div className="text-xs text-slate-500">价格：¥{item.cost}</div>
+                    <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (gameState.stats.money < item.cost) {
                          alert('穷小子，先赚点钱再来吧！');
                          return;
                        }

                        setGameState(prev => {
                          const newStats = { ...prev.stats };
                          // Deduct money
                          newStats.money = Math.max(0, prev.stats.money - item.cost);

                          // Apply numeric effects
                          if (item.effects.academic) newStats.academic = Math.min(100, (newStats.academic || 0) + (item.effects.academic as number));
                          if (item.effects.mood) newStats.mood = Math.min(100, (newStats.mood || 0) + (item.effects.mood as number));
                          if (item.effects.energy) newStats.energy = Math.min(100, (newStats.energy || 0) + (item.effects.energy as number));

                          // Build new state base
                          let newState: GameState = { ...prev, stats: newStats };

                          // Special effects: jump to last day
                          if (item.effects.jumpToLastDay) {
                            newState = {
                              ...newState,
                              week: MAX_WEEKS,
                              day: 7,
                              timeSlot: TimeSlot.Evening,
                            };
                          }

                          // Add history log
                          const log: LogEntry = {
                            id: Date.now().toString(),
                            text: `你在商店购买了 ${item.label}（¥${item.cost}）` + (item.effects.jumpToLastDay ? ' 并服下了它，时间被推进到了学期最后一天。' : ''),
                            type: 'event',
                            turn: prev.week * 100 + prev.day * 10,
                          };

                          return { ...newState, history: [...prev.history, log] };
                        });

                        // If the item jumps to last day, open weekly report shortly so player sees summary
                        if (item.effects.jumpToLastDay) {
                          setTimeout(() => setShowWeeklyReport(true), 400);
                        }

                        setShowShop(false);
                      }}
                      className="bg-amber-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-amber-600 transition-colors"
                    >购买</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Re-adding Invite/Shop/Jobs/Dining modals to ensure full file integrity */}
      {showInvite && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-pink-50">
                      <h2 className="text-lg font-bold text-pink-900 flex items-center gap-2"><UserPlus className="text-pink-600" /> 邀请谁呢？</h2>
                      <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[60vh] bg-slate-50 space-y-2">
                      {gameState.relationships.map(rel => {
                          const isKnown = rel.status !== 'Stranger' && rel.affinity > 20;
                          return (
                              <button key={rel.name} disabled={!isKnown && rel.affinity <= 20} onClick={() => {setShowInvite(false); handleAction(`邀请 ${rel.name} 出去玩`);}} className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:bg-pink-50 hover:border-pink-200 transition-all flex justify-between items-center disabled:opacity-50">
                                  <div>
                                      <div className="font-bold text-slate-800">{isKnown || rel.affinity > 20 ? rel.name : "???"}</div>
                                      <div className="text-xs text-slate-500">{rel.status}</div>
                                  </div>
                                  <div className="flex items-center gap-1"><Heart size={14} className={rel.affinity > 50 ? "fill-pink-500 text-pink-500" : "text-slate-300"} /><span className="text-sm font-mono">{isKnown || rel.affinity > 20 ? rel.affinity : '?'}</span></div>
                              </button>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}
      {/* Jobs Modal */}
      {showJobs && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
              <h2 className="text-lg font-bold text-emerald-900 flex items-center gap-2"><Briefcase className="text-emerald-600" /> 兼职工作</h2>
              <button onClick={() => setShowJobs(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] bg-slate-50 space-y-3">
              {/* Dynamic job options based on stats */}
              {(() => {
                const opts = [] as any[];
                const money = gameState.stats.money;
                const energy = gameState.stats.energy;
                // Simple gig - low pay, low cost
                opts.push({ id: 'part_time_easy', label: '送外卖（短时）', earn: 30, energyCost: 10, reqEnergy: 10, desc: '短时任务，收入小但消耗少。' });
                // Normal shift
                opts.push({ id: 'part_time_normal', label: '咖啡店班次', earn: 100, energyCost: 30, reqEnergy: 25, desc: '标准班次，适中收入，需一定体力。' });
                // High-pay but requires energy or skill
                opts.push({ id: 'part_time_high', label: '家教一节课', earn: 200, energyCost: 40, reqEnergy: 40, desc: '高报酬，需精力充足或专业能力。' });
                return opts.map(opt => (
                  <div key={opt.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-800">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-slate-600">收益：¥{opt.earn}</div>
                      <button
                        onClick={async () => {
                          if (gameState.stats.energy < opt.reqEnergy) {
                            alert('体力不足，无法完成该工作');
                            return;
                          }
                          const prev = gameState;
                          const newStatsBase = { ...prev.stats };
                          newStatsBase.money = Math.max(0, (newStatsBase.money || 0) + opt.earn);
                          newStatsBase.energy = Math.max(0, (newStatsBase.energy || 0) - opt.energyCost);

                          const baseLog: LogEntry = {
                            id: Date.now().toString(),
                            text: `你开始了：${opt.label}`,
                            type: 'choice',
                            turn: prev.week * 100 + prev.day * 10,
                          };

                          const stateForAI: GameState = { ...prev, stats: newStatsBase, history: [...prev.history, baseLog] };
                          setGameState(stateForAI);
                          setShowJobs(false);

                          setLoading(true);
                          try {
                            const resp = await generateTurn(stateForAI, opt.label);
                            setGameState(curr => {
                              const mergedStats = { ...curr.stats };
                              if (resp.statChanges) {
                                (Object.entries(resp.statChanges) as [string, any][]).forEach(([k, v]) => {
                                  const key = k as keyof CharacterStats;
                                  const delta = v as number;

                                  if (key === 'money') {
                                    // 💰 钱：只保证不为负，不要上限
                                    mergedStats.money = Math.max(0, (mergedStats.money ?? 0) + delta);
                                  } else {
                                    // 其他属性：仍然 0–100
                                    mergedStats[key] = Math.min(
                                      100,
                                      Math.max(0, (mergedStats[key] ?? 0) + delta)
                                    );
                                  }
                                });
                              }


                              let rels = curr.relationships;
                              if (resp.relationshipUpdates) {
                                rels = rels.map(r => {
                                  const upd = resp.relationshipUpdates!.find(u => u.name === r.name);
                                  if (upd) return { ...r, affinity: Math.min(100, Math.max(0, r.affinity + upd.change)) };
                                  return r;
                                });
                              }

                              const logs = [...curr.history, { id: Date.now().toString(), text: resp.narrative, type: 'narrative', turn: curr.week * 100 + curr.day * 10 }];
                              let msgs = curr.messages;
                              if (resp.sms) msgs = [...msgs, { id: Date.now().toString(), sender: resp.sms.sender, content: resp.sms.content, isRead: false, timestamp: new Date().toISOString() }];

                              const wishes = updateWishProgress({ ...curr, stats: mergedStats, relationships: rels });

                              return { ...curr, stats: mergedStats, relationships: rels, history: logs, messages: msgs, wishes };
                            });
                          } catch (err) {
                            console.error('工作动作生成失败', err);
                            alert('无法找到该次工作的剧情内容，请检查网络或稍后再试');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-emerald-600 transition-colors"
                      >去做</button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Random Event Modal */}
      {showEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          {eventLoading ? (
            // Loading state
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-rose-50">
                <h2 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="text-rose-600" size={20} /> 
                  随机事件
                </h2>
              </div>
              <div className="p-12 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-rose-50 to-pink-50 min-h-[300px]">
                {/* Loading spinner */}
                <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div>
                <p className="text-slate-600 font-medium text-center">正在遭遇事件，请稍候…</p>
                <p className="text-xs text-slate-400 text-center">若长时间无响应，可重试。</p>
              </div>
            </div>
          ) : eventError ? (
            // Error state (allow retry/close)
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-rose-50">
                <h2 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="text-rose-600" size={20} /> 
                  随机事件 - 错误
                </h2>
                <button onClick={() => { setShowEvent(false); setEventError(null); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="p-6 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-rose-50 to-pink-50 min-h-[220px]">
                <p className="text-slate-700 text-center">{eventError}</p>
                <div className="flex gap-3">
                  <button onClick={() => { setEventError(null); triggerRandomEvent(); }} className="px-4 py-2 rounded bg-rose-600 text-white">重试</button>
                  <button onClick={() => { setShowEvent(false); setEventError(null); }} className="px-4 py-2 rounded bg-white border">关闭</button>
                </div>
              </div>
            </div>
          ) : (
            // Event content state
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-rose-50">
                <h2 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="text-rose-600" size={20} /> 
                  随机事件
                </h2>
                {!eventLoading && currentEvent && (
                  <button 
                    onClick={() => setShowEvent(false)} 
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
              <div className="p-6 overflow-y-auto flex-1 bg-gradient-to-br from-rose-50 to-pink-50 space-y-4">
                <h3 className="text-2xl font-bold text-rose-900">{currentEvent.title}</h3>
                <p className="text-slate-700 leading-relaxed">{currentEvent.description}</p>
                
                <div className="space-y-3 mt-6">
                  {currentEvent.choices.map((choice: any) => (
                    <button
                      key={choice.id}
                      onClick={() => handleEventChoice(choice.id)}
                      disabled={eventLoading}
                      className="w-full p-4 text-left rounded-lg border-2 border-rose-200 bg-white hover:bg-rose-50 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                    >
                      <div className="font-semibold text-rose-900 group-hover:text-rose-700">
                        {choice.text}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dining Modal */}
      {showDining && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-yellow-50">
              <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2"><Utensils className="text-amber-600" /> 去干饭</h2>
              <button onClick={() => setShowDining(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] bg-slate-50 space-y-3">
              {(() => {
                const opts = [] as any[];
                const money = gameState.stats.money;
                // Cheap eat
                opts.push({ id: 'eat_cheapest', label: '食堂快餐', cost: 8, mood: 3, energy: 8, desc: '便宜实惠，微幅恢复。' });
                // Normal eat
                opts.push({ id: 'eat_normal', label: '路边小馆', cost: 28, mood: 8, energy: 20, desc: '常规选择，恢复适中。' });
                // Luxury
                opts.push({ id: 'eat_luxury', label: '满天星餐厅', cost: 120, mood: 20, energy: 40, desc: '奢华体验，大幅恢复并小幅提高心情。' });
                return opts.map(opt => (
                  <div key={opt.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-800">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-slate-600">价格：¥{opt.cost}</div>
                      <button
                        onClick={async () => {
                          if (gameState.stats.money < opt.cost) { alert('钱不够了'); return; }
                          const prev = gameState;
                          const newStatsBase = { ...prev.stats };
                          // newStatsBase.money = Math.max(0, newStatsBase.money - opt.cost);
                          newStatsBase.mood = Math.min(100, (newStatsBase.mood || 0) + opt.mood);
                          newStatsBase.energy = Math.min(100, (newStatsBase.energy || 0) + opt.energy);

                          const baseLog: LogEntry = {
                            id: Date.now().toString(),
                            text: `你去吃了：${opt.label}（¥${opt.cost}）`,
                            type: 'choice',
                            turn: prev.week * 100 + prev.day * 10,
                          };

                          const stateForAI: GameState = { ...prev, stats: newStatsBase, history: [...prev.history, baseLog] };
                          setGameState(stateForAI);
                          setShowDining(false);

                          setLoading(true);
                          try {
                            const resp = await generateTurn(stateForAI, opt.label);
                            setGameState(curr => {
                              const mergedStats = { ...curr.stats };
                              if (resp.statChanges) {
                                (Object.entries(resp.statChanges) as [string, any][]).forEach(([k, v]) => {
                                  const key = k as keyof CharacterStats;
                                  mergedStats[key] = Math.min(100, Math.max(0, (mergedStats[key] || 0) + (v as number)));
                                });
                              }

                              let rels = curr.relationships;
                              if (resp.relationshipUpdates) {
                                rels = rels.map(r => {
                                  const upd = resp.relationshipUpdates!.find(u => u.name === r.name);
                                  if (upd) return { ...r, affinity: Math.min(100, Math.max(0, r.affinity + upd.change)) };
                                  return r;
                                });
                              }

                              const logs = [...curr.history, { id: Date.now().toString(), text: resp.narrative, type: 'narrative', turn: curr.week * 100 + curr.day * 10 }];
                              let msgs = curr.messages;
                              if (resp.sms) msgs = [...msgs, { id: Date.now().toString(), sender: resp.sms.sender, content: resp.sms.content, isRead: false, timestamp: new Date().toISOString() }];

                              const wishes = updateWishProgress({ ...curr, stats: mergedStats, relationships: rels });

                              return { ...curr, stats: mergedStats, relationships: rels, history: logs, messages: msgs, wishes };
                            });
                          } catch (err) {
                            console.error('用餐动作生成失败', err);
                            alert('无法生成本次用餐的剧情内容，请检查网络或稍后再试');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="bg-amber-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-amber-600 transition-colors"
                      >去吃</button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
      
      {/* ... Keeping existing Shop/Jobs/Dining logic inside App return ... */}
    </div>
  );
};

// --- Entry Point ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}

export default App;