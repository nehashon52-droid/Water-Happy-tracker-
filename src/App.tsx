import React, { useState, useEffect, Component } from 'react';
import { auth, db, onAuthStateChanged, signInWithPopup, googleProvider, signOut, User, collection, query, where, onSnapshot, orderBy, limit, addDoc, Timestamp, updateDoc, deleteDoc, doc, handleFirestoreError, OperationType, getDoc, setDoc } from './lib/firebase';
import { LogIn, LogOut, Droplets, Footprints, Heart, Smile, Sun, Moon, Plus, Check, Trash2, BookOpen, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { getJoke } from './services/geminiService';
import { cn } from './lib/utils';

// --- Components ---

class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let errorMessage = "Something went wrong.";
      if (error && error.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errorMessage = `Firestore Error: ${parsed.error}`;
        } catch (e) {
          errorMessage = error.message;
        }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-red-100">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-900">Oops!</h2>
            <p className="text-gray-600">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} variant="primary" className="w-full">
              Reload App
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode, className?: string, title?: string, icon?: any }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("glass-morphism rounded-3xl p-6", className)}
  >
    {title && (
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-5 h-5 text-indigo-400" />}
        <h3 className="font-semibold text-slate-100">{title}</h3>
      </div>
    )}
    {children}
  </motion.div>
);

const Button = ({ children, onClick, variant = 'primary', className, icon: Icon, disabled }: any) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20',
    secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600 border border-slate-600',
    outline: 'border border-slate-700 text-slate-300 hover:bg-slate-800',
    ghost: 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
    danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
  };
  
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50",
        variants[variant as keyof typeof variants],
        className
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

const BackgroundAnimation = () => {
  const devices = [
    { icon: Footprints, label: 'Steps', delay: 0, x: '10%', y: '20%' },
    { icon: Heart, label: 'Heart', delay: 2, x: '85%', y: '15%' },
    { icon: Smile, label: 'Happy', delay: 4, x: '75%', y: '70%' },
    { icon: Droplets, label: 'Water', delay: 1, x: '15%', y: '75%' },
    { icon: BookOpen, label: 'Diary', delay: 3, x: '50%', y: '10%' },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute inset-0 bg-grid-slate-900 opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Animated Device Icons */}
      {devices.map((device, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ 
            opacity: [0.1, 0.3, 0.1],
            scale: [1, 1.1, 1],
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity, 
            delay: device.delay,
            ease: "easeInOut" 
          }}
          className="absolute hidden lg:flex flex-col items-center gap-2"
          style={{ left: device.x, top: device.y }}
        >
          <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm">
            <device.icon className="w-8 h-8 text-indigo-500/50" />
          </div>
          <span className="text-[10px] font-bold text-indigo-400/30 uppercase tracking-widest">{device.label}</span>
        </motion.div>
      ))}

      {/* Floating Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full" />
    </div>
  );
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data States
  const [waterLogs, setWaterLogs] = useState<any[]>([]);
  const [stepLogs, setStepLogs] = useState<any[]>([]);
  const [heartLogs, setHeartLogs] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [diaryNotes, setDiaryNotes] = useState<any[]>([]);
  
  // Happy Tracker States
  const [mood, setMood] = useState('Happy');
  const [jokeZone, setJokeZone] = useState('Dad Jokes');
  const [currentJoke, setCurrentJoke] = useState('');
  const [jokeLoading, setJokeLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    // Water Logs
    const qWater = query(collection(db, 'waterLogs'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(10));
    const unsubWater = onSnapshot(qWater, (s) => {
      setWaterLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'waterLogs'));

    // Step Logs
    const qSteps = query(collection(db, 'stepLogs'), where('uid', '==', user.uid), where('date', '==', today));
    const unsubSteps = onSnapshot(qSteps, (s) => {
      setStepLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'stepLogs'));

    // Heart Logs
    const qHeart = query(collection(db, 'heartRateLogs'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(10));
    const unsubHeart = onSnapshot(qHeart, (s) => {
      setHeartLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'heartRateLogs'));

    // Habits
    const qHabits = query(collection(db, 'habits'), where('uid', '==', user.uid), where('date', '==', today));
    const unsubHabits = onSnapshot(qHabits, (s) => {
      setHabits(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'habits'));

    // Diary
    const qDiary = query(collection(db, 'diaryNotes'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(5));
    const unsubDiary = onSnapshot(qDiary, (s) => {
      setDiaryNotes(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'diaryNotes'));

    return () => {
      unsubWater();
      unsubSteps();
      unsubHeart();
      unsubHabits();
      unsubDiary();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Update user profile in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: Timestamp.now()
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => signOut(auth);

  const addWater = async (amount: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'waterLogs'), {
        uid: user.uid,
        amount,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'waterLogs');
    }
  };

  const addHeartRate = async (bpm: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'heartRateLogs'), {
        uid: user.uid,
        bpm,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'heartRateLogs');
    }
  };

  const generateJoke = async () => {
    setJokeLoading(true);
    const joke = await getJoke(mood, jokeZone);
    setCurrentJoke(joke);
    setJokeLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
  </div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <BackgroundAnimation />
      <Card className="max-w-md w-full text-center space-y-6 relative z-10">
        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto border border-indigo-500/30">
          <Droplets className="w-10 h-10 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Water Happy</h1>
          <p className="text-slate-400 mt-2">The ultimate wellness evolution. Track water, steps, heart, and happiness in a stunning dark interface.</p>
        </div>
        <Button onClick={handleLogin} className="w-full py-4 text-lg" icon={LogIn}>
          Sign in with Google
        </Button>
      </Card>
    </div>
  );

  const totalWater = waterLogs.reduce((acc, log) => acc + log.amount, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-24 relative">
      <BackgroundAnimation />
      
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">Water Happy</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-slate-100">{user.displayName}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <img src={user.photoURL || ''} alt="Profile" className="w-8 h-8 rounded-full border border-slate-700 shadow-sm" />
            <Button onClick={handleLogout} variant="ghost" icon={LogOut} className="p-2" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8 relative z-10">
        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Water Tracker */}
          <Card title="Water Intake" icon={Droplets} className="md:col-span-1">
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-indigo-400">{totalWater} <span className="text-lg font-normal text-slate-500">ml</span></div>
              <p className="text-sm text-slate-500 mt-1">Daily Goal: 2500ml</p>
              <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((totalWater / 2500) * 100, 100)}%` }}
                  className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[250, 500, 750].map(amt => (
                <Button key={amt} onClick={() => addWater(amt)} variant="secondary" className="text-xs px-2">
                  +{amt}ml
                </Button>
              ))}
            </div>
          </Card>

          {/* Steps Tracker */}
          <Card title="Steps Today" icon={Footprints} className="md:col-span-1">
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-emerald-400">{stepLogs[0]?.count || 0} <span className="text-lg font-normal text-slate-500">steps</span></div>
              <p className="text-sm text-slate-500 mt-1">Goal: 10,000</p>
            </div>
            <Button onClick={async () => {
              const current = stepLogs[0]?.count || 0;
              const today = format(new Date(), 'yyyy-MM-dd');
              try {
                if (stepLogs[0]) {
                  await updateDoc(doc(db, 'stepLogs', stepLogs[0].id), { count: current + 1000, updatedAt: Timestamp.now() });
                } else {
                  await addDoc(collection(db, 'stepLogs'), { uid: user.uid, count: 1000, date: today, updatedAt: Timestamp.now() });
                }
              } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, 'stepLogs');
              }
            }} variant="secondary" className="w-full" icon={Plus}>
              Add 1000 Steps
            </Button>
          </Card>

          {/* Heart Rate */}
          <Card title="Heart Rate" icon={Heart} className="md:col-span-1">
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-rose-400">{heartLogs[0]?.bpm || '--'} <span className="text-lg font-normal text-slate-500">bpm</span></div>
              <p className="text-sm text-slate-500 mt-1">Last measured: {heartLogs[0] ? format(heartLogs[0].timestamp.toDate(), 'HH:mm') : 'Never'}</p>
            </div>
            <div className="flex gap-2">
              <input 
                type="number" 
                placeholder="BPM" 
                id="bpmInput"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              />
              <Button onClick={() => {
                const el = document.getElementById('bpmInput') as HTMLInputElement;
                const val = parseInt(el.value);
                if (el.value && !isNaN(val) && val > 0) {
                  addHeartRate(val);
                  el.value = '';
                }
              }} variant="secondary" className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20">
                Log
              </Button>
            </div>
          </Card>
        </div>

        {/* Happy Tracker & Habits */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Happy Tracker */}
          <Card title="Happy Tracker" icon={Smile} className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/20">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-indigo-400 uppercase mb-1">How are you feeling?</label>
                  <select 
                    value={mood} 
                    onChange={(e) => setMood(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    {['Happy', 'Sad', 'Bored', 'Stressed', 'Energetic'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-indigo-400 uppercase mb-1">Joke Zone</label>
                  <select 
                    value={jokeZone} 
                    onChange={(e) => setJokeZone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    {['Dad Jokes', 'Puns', 'Knock-Knock', 'Sarcastic', 'Wholesome'].map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
              </div>
              
              <Button 
                onClick={generateJoke} 
                disabled={jokeLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                icon={Smile}
              >
                {jokeLoading ? 'Thinking of something funny...' : 'Make Me Happy!'}
              </Button>

              <AnimatePresence mode="wait">
                {currentJoke && (
                  <motion.div 
                    key={currentJoke}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-800/50 p-4 rounded-2xl border border-indigo-500/20 text-slate-200 italic text-center relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    "{currentJoke}"
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>

          {/* Morning Habits */}
          <Card title="Morning Habits" icon={Sun} className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20">
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="New habit..." 
                  id="habitInput"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <select id="habitType" className="bg-slate-800 border border-slate-700 rounded-xl px-2 text-sm text-slate-200">
                  <option value="good">Good</option>
                  <option value="bad">Bad</option>
                </select>
                <Button onClick={async () => {
                  const input = document.getElementById('habitInput') as HTMLInputElement;
                  const type = document.getElementById('habitType') as HTMLSelectElement;
                  if (input.value) {
                    try {
                      await addDoc(collection(db, 'habits'), {
                        uid: user.uid,
                        title: input.value,
                        type: type.value,
                        completed: false,
                        date: format(new Date(), 'yyyy-MM-dd')
                      });
                      input.value = '';
                    } catch (e) {
                      handleFirestoreError(e, OperationType.CREATE, 'habits');
                    }
                  }
                }} variant="secondary" className="bg-amber-600 text-white hover:bg-amber-500 border-none">
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {habits.map(habit => (
                  <motion.div 
                    layout
                    key={habit.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border transition-all",
                      habit.completed ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'habits', habit.id), { completed: !habit.completed });
                          } catch (e) {
                            handleFirestoreError(e, OperationType.UPDATE, `habits/${habit.id}`);
                          }
                        }}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                          habit.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-600"
                        )}
                      >
                        {habit.completed && <Check className="w-4 h-4" />}
                      </button>
                      <div>
                        <p className={cn("text-sm font-medium", habit.completed ? "line-through text-slate-500" : "text-slate-200")}>{habit.title}</p>
                        <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", habit.type === 'good' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
                          {habit.type === 'good' ? 'Good Habit' : 'Leave Bad Habit'}
                        </span>
                      </div>
                    </div>
                    <Button onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'habits', habit.id));
                      } catch (e) {
                        handleFirestoreError(e, OperationType.DELETE, `habits/${habit.id}`);
                      }
                    }} variant="ghost" className="p-1 text-slate-600 hover:text-rose-400" icon={Trash2} />
                  </motion.div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Nightly Diary */}
        <Card title="Nightly Diary" icon={Moon} className="bg-slate-900 border-slate-800">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">How was your day?</label>
              <textarea 
                id="diaryInput"
                placeholder="Write your nightly notes here..."
                className="w-full h-32 bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />
              <div className="flex justify-end">
                <Button onClick={async () => {
                  const el = document.getElementById('diaryInput') as HTMLTextAreaElement;
                  if (el.value) {
                    try {
                      await addDoc(collection(db, 'diaryNotes'), {
                        uid: user.uid,
                        content: el.value,
                        date: format(new Date(), 'yyyy-MM-dd'),
                        createdAt: Timestamp.now()
                      });
                      el.value = '';
                    } catch (e) {
                      handleFirestoreError(e, OperationType.CREATE, 'diaryNotes');
                    }
                  }
                }} className="bg-indigo-600 hover:bg-indigo-500">
                  Save Entry
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-2">Recent Entries</h4>
              {diaryNotes.map(note => (
                <div key={note.id} className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{format(note.createdAt.toDate(), 'MMM dd, yyyy')}</span>
                    <Button onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'diaryNotes', note.id));
                      } catch (e) {
                        handleFirestoreError(e, OperationType.DELETE, `diaryNotes/${note.id}`);
                      }
                    }} variant="ghost" className="p-0 h-auto text-slate-600 hover:text-rose-400" icon={Trash2} />
                  </div>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </main>

      {/* Navigation Rail (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 p-2 flex justify-around sm:hidden z-30">
        <Button variant="ghost" className="flex-col gap-1 p-2 text-[10px]" icon={Droplets}>Water</Button>
        <Button variant="ghost" className="flex-col gap-1 p-2 text-[10px]" icon={Footprints}>Steps</Button>
        <Button variant="ghost" className="flex-col gap-1 p-2 text-[10px]" icon={Smile}>Happy</Button>
        <Button variant="ghost" className="flex-col gap-1 p-2 text-[10px]" icon={BookOpen}>Diary</Button>
      </nav>
    </div>
  );
}
