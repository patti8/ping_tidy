'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Trash2,
    CheckCircle2,
    Circle,
    Calendar,
    History,
    LogOut,
    LayoutGrid,
    RefreshCw,
    Check,
    Languages,
    Globe,
    Sun,
    Moon,
    User as UserIcon,
    Database,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Search,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db, auth, googleProvider } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Habit {
    id: string;
    text: string;
}

export default function HabitTracker() {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
    const [habits, setHabits] = useState<Habit[]>([]);
    const [completions, setCompletions] = useState<{ [date: string]: string[] }>({});
    const [newHabit, setNewHabit] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSynced, setLastSynced] = useState<string | null>(null);
    const [language, setLanguage] = useState<'id' | 'en'>('id');
    const [showCalendar, setShowCalendar] = useState(false);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    const t = {
        id: {
            halo: 'Halo,',
            cloud_active: 'Cloud Aktif',
            syncing: 'Sinkron...',
            terhubung: 'Terhubung',
            offline: 'Offline',
            target: 'Target',
            hari: 'Hari',
            hari_ini: 'Hari Ini',
            terpilih: 'Terpilih',
            placeholder: 'Tulis target baru Anda...',
            belum_ada_data: 'Belum ada data di cloud.',
            riwayat: 'Riwayat',
            perjalanan: 'Project History',
            selesai: 'Selesai',
            keluar: 'Keluar',
            tersimpan: 'Tersimpan',
            tagline: 'Simpan kebiasaan Anda secara permanen di cloud. Data tersinkronisasi antar perangkat.',
            mulai: 'Mulai dengan Google',
            detail_tugas: 'Detail Tugas',
            semua_tugas: 'Semua Tugas Terdata',
            tutup: 'Tutup',
            reset_filter: 'Lihat 7 Hari Terakhir',
            pilih_tanggal: 'Pilih tanggal di kalender untuk filter',
        },
        en: {
            halo: 'Hello,',
            cloud_active: 'Cloud Active',
            syncing: 'Syncing...',
            terhubung: 'Connected',
            offline: 'Offline',
            target: 'Today\'s',
            hari: 'Target',
            hari_ini: 'Today',
            terpilih: 'List',
            placeholder: 'Write your new target...',
            belum_ada_data: 'No data in the cloud yet.',
            riwayat: 'Progress',
            perjalanan: 'Project History',
            selesai: 'Done',
            keluar: 'Logout',
            tersimpan: 'Saved',
            tagline: 'Save your habits permanently in the cloud. Data is synced across devices.',
            mulai: 'Start with Google',
            detail_tugas: 'Task Details',
            semua_tugas: 'All Recorded Tasks',
            tutup: 'Close',
            reset_filter: 'Show Last 7 Days',
            pilih_tanggal: 'Click a date in calendar to filter',
        }
    }[language];

    const getTodayDate = () => new Date().toISOString().split('T')[0];
    const today = getTodayDate();

    // 1. Initial Load (Theme & Local Fallback)
    useEffect(() => {
        try {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') setIsDarkMode(true);

            const savedLang = localStorage.getItem('language');
            if (savedLang === 'en' || savedLang === 'id') setLanguage(savedLang);

            // Load local fallback for immediate UI response
            const localHabits = localStorage.getItem('local_habits_fallback');
            const localCompletions = localStorage.getItem('local_completions_fallback');
            if (localHabits) setHabits(JSON.parse(localHabits));
            if (localCompletions) setCompletions(JSON.parse(localCompletions));

            const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
                setUser(firebaseUser);
                setIsLoading(false);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error('Error loading initial state:', error);
            setIsLoading(false);
        }
    }, []);

    // 2. Real-time Firestore Sync (Source of Truth)
    useEffect(() => {
        if (!user) {
            setHabits([]);
            setCompletions({});
            setDataLoading(false);
            return;
        }

        setDataLoading(true);
        const userDocRef = doc(db, 'users', user.uid); // Use UID instead of Email for better security

        const unsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.habits) {
                    setHabits(data.habits);
                    localStorage.setItem('local_habits_fallback', JSON.stringify(data.habits));
                }
                if (data.completions) {
                    setCompletions(data.completions);
                    localStorage.setItem('local_completions_fallback', JSON.stringify(data.completions));
                }
                setLastSynced(new Date().toLocaleTimeString());
            }
            setIsDataLoaded(true);
            setDataLoading(false);
            setError(null);
        }, (err) => {
            console.error('Firestore Error:', err);
            // Don't mark as loaded if there's an error so we don't overwrite cloud accidentally
            setError('Cloud Sync Error: Cek Firebase Rules atau Koneksi.');
            setDataLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // 3. Theme effect
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const saveToFirebase = async (newHabits: Habit[], newCompletions: { [date: string]: string[] }) => {
        if (!user || !isDataLoaded) return; // CRITICAL: Stop save if data haven't loaded from cloud yet

        setIsSyncing(true);
        try {
            // Also update local fallback immediatey
            localStorage.setItem('local_habits_fallback', JSON.stringify(newHabits));
            localStorage.setItem('local_completions_fallback', JSON.stringify(newCompletions));

            await setDoc(doc(db, 'users', user.uid), {
                habits: newHabits,
                completions: newCompletions,
                lastUpdated: new Date().toISOString(),
                email: user.email,
                name: user.displayName
            }, { merge: true });

            setLastSynced(new Date().toLocaleTimeString());
            setError(null);
        } catch (err) {
            console.error('Save error:', err);
            setError('Gagal menyimpan ke Cloud. Data tersimpan di Lokal.');
        } finally {
            setIsSyncing(false);
        }
    };

    const toggleLanguage = () => {
        const newLang = language === 'id' ? 'en' : 'id';
        setLanguage(newLang);
        localStorage.setItem('language', newLang);
    };

    const loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error('Login error:', err);
            setError('Gagal masuk dengan Google.');
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const addHabit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newHabit.trim()) return;

        const habit = { id: Date.now().toString(), text: newHabit.trim() };
        const updatedHabits = [...habits, habit];

        // Optimistic UI update
        setHabits(updatedHabits);
        setNewHabit('');

        await saveToFirebase(updatedHabits, completions);
    };

    const deleteHabit = async (id: string) => {
        const updatedHabits = habits.filter(h => h.id !== id);
        setHabits(updatedHabits);
        await saveToFirebase(updatedHabits, completions);
    };

    const toggleHabit = async (id: string, date = today) => {
        const currentDayIds = completions[date] || [];
        const isNowDone = !currentDayIds.includes(id);

        const newDayIds = isNowDone
            ? [...currentDayIds, id]
            : currentDayIds.filter(hid => hid !== id);

        const newCompletions = { ...completions, [date]: newDayIds };
        setCompletions(newCompletions);
        await saveToFirebase(habits, newCompletions);
    };

    const getProgress = (date: string) => {
        if (habits.length === 0) return 0;
        const doneCount = (completions[date] || []).length;
        return Math.round((doneCount / habits.length) * 100);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
                <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-gradient-to-b from-white to-blue-50 dark:from-slate-950 dark:to-slate-900">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center max-w-sm"
                >
                    <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/30">
                        <Database className="text-white w-12 h-12" />
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter">
                        Habbit
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-10 text-lg leading-relaxed font-medium">
                        {t.tagline}
                    </p>
                    <button
                        onClick={loginWithGoogle}
                        className="w-full flex items-center justify-center gap-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-white font-bold py-5 px-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all border border-slate-100 dark:border-slate-700 active:scale-[0.98] text-lg"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        {t.mulai}
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background transition-colors duration-500 pb-40">
            <div className="max-w-2xl mx-auto px-6 pt-10 relative">
                <header className="flex justify-between items-center mb-12">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="User" className="w-14 h-14 rounded-3xl shadow-xl border-4 border-white dark:border-slate-800" />
                            ) : (
                                <div className="w-14 h-14 bg-blue-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center">
                                    <UserIcon className="text-blue-600 w-7 h-7" />
                                </div>
                            )}
                            {(isSyncing || dataLoading) && (
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5 border-4 border-white dark:border-slate-900 shadow-lg z-10">
                                    <RefreshCw className="w-2.5 h-2.5 text-white" />
                                </motion.div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Patti Hub</h2>
                                {dataLoading ? (
                                    <span className="text-[10px] text-blue-500 font-bold uppercase animate-pulse">{t.syncing}</span>
                                ) : error ? (
                                    <span className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1">
                                        <AlertCircle className="w-2.5 h-2.5" /> {t.offline}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-green-500 font-bold uppercase flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" /> {t.cloud_active}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{user.displayName}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{user.email}</p>
                                {lastSynced && !error && (
                                    <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-tighter italic">{t.tersimpan} {lastSynced}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={toggleLanguage}
                            className="p-4 bg-white dark:bg-slate-800 rounded-3xl text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-all border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl group flex items-center gap-2">
                            <Languages className="w-6 h-6" />
                            <span className="text-[10px] font-black group-hover:block hidden">{language.toUpperCase()}</span>
                        </button>
                        <button onClick={() => setIsDarkMode(!isDarkMode)}
                            className="p-4 bg-white dark:bg-slate-800 rounded-3xl text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-all border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl">
                            {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                        </button>
                        <button onClick={handleLogout}
                            className="p-4 bg-white dark:bg-slate-800 rounded-3xl text-slate-500 dark:text-slate-400 hover:text-red-600 transition-all border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl">
                            <LogOut className="w-6 h-6" />
                        </button>
                    </div>
                </header>

                <main>
                    {error && (
                        <div className="mb-8 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 p-5 rounded-3xl flex items-center gap-4 text-red-600 dark:text-red-400 text-sm font-bold shadow-lg shadow-red-200/20">
                            <AlertCircle className="w-6 h-6 shrink-0" />
                            {error}
                        </div>
                    )}

                    {activeTab === 'today' ? (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h3 className="text-4xl font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tighter">
                                        {t.hari} <span className="text-blue-600">{t.terpilih}</span>
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 font-bold text-lg mt-1">
                                        {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-3xl font-black text-blue-600">{getProgress(today)}%</span>
                                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">{t.selesai}</span>
                                </div>
                            </div>

                            <form onSubmit={addHabit} className="relative group">
                                <input type="text" value={newHabit} onChange={(e) => setNewHabit(e.target.value)} placeholder={t.placeholder}
                                    className="w-full bg-white dark:bg-slate-800 border-none shadow-2xl shadow-blue-200/40 dark:shadow-none rounded-[2.5rem] py-8 px-10 pr-20 focus:ring-4 focus:ring-blue-500/10 outline-none text-slate-700 dark:text-white text-xl font-medium transition-all" />
                                <button type="submit" className="absolute right-4 top-4 bottom-4 aspect-square bg-blue-600 text-white rounded-[1.8rem] flex items-center justify-center hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 active:scale-90">
                                    <Plus className="w-8 h-8" />
                                </button>
                            </form>

                            <div className="space-y-5">
                                <AnimatePresence mode="popLayout">
                                    {habits.length === 0 ? (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem]">
                                            <Database className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                                            <p className="text-slate-400 font-bold text-xl">{t.belum_ada_data}</p>
                                        </motion.div>
                                    ) : (
                                        habits.map((habit) => {
                                            const isDone = (completions[today] || []).includes(habit.id);
                                            return (
                                                <motion.div key={habit.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                                    className={cn("group flex items-center p-8 rounded-[2.5rem] transition-all duration-300 border-2", isDone ? "bg-blue-600 border-blue-600 shadow-2xl shadow-blue-500/30" : "bg-white dark:bg-slate-800 border-transparent shadow-sm hover:shadow-xl dark:hover:border-slate-700")}>
                                                    <button onClick={() => toggleHabit(habit.id)} className="mr-6 focus:outline-none shrink-0">
                                                        {isDone ? <div className="bg-white rounded-2xl p-1.5"><CheckCircle2 className="text-blue-600 w-10 h-10" /></div> : <Circle className="text-slate-200 dark:text-slate-700 w-10 h-10 hover:text-blue-500 transition-colors" />}
                                                    </button>
                                                    <span className={cn("flex-1 font-extrabold text-2xl transition-all", isDone ? "text-white/80 line-through" : "text-slate-800 dark:text-slate-100")}>{habit.text}</span>
                                                    <button onClick={() => deleteHabit(habit.id)} className={cn("p-4 rounded-2xl transition-all", isDone ? "text-white/40 hover:text-white" : "opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500")}>
                                                        <Trash2 className="w-6 h-6" />
                                                    </button>
                                                </motion.div>
                                            );
                                        })
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-tighter">
                                    {t.riwayat} <span className="text-blue-600">History</span>
                                </h3>
                                <button
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className={cn(
                                        "p-3 rounded-2xl transition-all border shadow-sm",
                                        showCalendar
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700 hover:text-blue-600"
                                    )}
                                >
                                    <Calendar className="w-5 h-5" />
                                </button>
                            </div>

                            <AnimatePresence>
                                {showCalendar && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden"
                                    >
                                        <div className="flex justify-between items-center mb-6">
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() - 1)))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                                <ChevronLeft className="w-5 h-5 text-slate-400" />
                                            </button>
                                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-sm">
                                                {calendarMonth.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })}
                                            </h4>
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() + 1)))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                                <ChevronRight className="w-5 h-5 text-slate-400" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-2">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                                <div key={i} className="text-[10px] font-black text-slate-300 dark:text-slate-600 text-center py-2">{day}</div>
                                            ))}
                                            {(() => {
                                                const days = [];
                                                const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
                                                const numDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();

                                                for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);

                                                for (let i = 1; i <= numDays; i++) {
                                                    const currentDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i);
                                                    const dateStr = currentDay.toISOString().split('T')[0];
                                                    const progress = getProgress(dateStr);
                                                    const isToday = dateStr === today;
                                                    const isSelected = selectedDate === dateStr;

                                                    days.push(
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                setSelectedDate(isSelected ? null : dateStr);
                                                                setExpandedDate(dateStr);
                                                            }}
                                                            className={cn(
                                                                "relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all group overflow-hidden border-2",
                                                                isSelected ? "border-blue-600 ring-2 ring-blue-500/20" : "border-transparent"
                                                            )}
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "absolute inset-0 transition-all opacity-20",
                                                                    progress === 100 ? "bg-green-500" : progress > 0 ? "bg-blue-500" : "bg-slate-100 dark:bg-slate-900"
                                                                )}
                                                                style={{ height: `${progress}%`, top: 'auto' }}
                                                            />
                                                            <span className={cn(
                                                                "relative z-10 text-[10px] font-bold",
                                                                isToday ? "text-blue-600 underline decoration-2 underline-offset-4" :
                                                                    isSelected ? "text-blue-600" : "text-slate-600 dark:text-slate-400"
                                                            )}>
                                                                {i}
                                                            </span>
                                                            {progress > 0 && (
                                                                <span className="relative z-10 text-[8px] font-black text-blue-600 dark:text-blue-400 leading-none mt-0.5">{progress}%</span>
                                                            )}
                                                        </button>
                                                    );
                                                }
                                                return days;
                                            })()}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="grid gap-6 pb-20">
                                {selectedDate && (
                                    <div className="flex justify-between items-center mb-2 px-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.pilih_tanggal}</p>
                                        <button
                                            onClick={() => { setSelectedDate(null); setExpandedDate(null); }}
                                            className="text-xs font-black text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl transition-all"
                                        >
                                            {t.reset_filter}
                                        </button>
                                    </div>
                                )}

                                {(selectedDate ? [(() => {
                                    const [y, m, d] = selectedDate.split('-').map(Number);
                                    return new Date(y, m - 1, d);
                                })()] : Array.from({ length: 7 }, (_, i) => {
                                    const d = new Date(); d.setDate(d.getDate() - i);
                                    return d;
                                })).map((d) => {
                                    const dateKey = d.toISOString().split('T')[0];
                                    const progress = getProgress(dateKey);
                                    const isToday = dateKey === today;
                                    const isExpanded = expandedDate === dateKey;
                                    const doneIds = completions[dateKey] || [];

                                    return (
                                        <div
                                            key={dateKey}
                                            className={cn(
                                                "rounded-[3rem] shadow-sm border-2 transition-all overflow-hidden",
                                                isToday ? "bg-white dark:bg-slate-800 border-blue-600/20" : "bg-white dark:bg-slate-800 border-transparent",
                                                isExpanded && "ring-4 ring-blue-500/10"
                                            )}
                                        >
                                            <button
                                                onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                                                className="w-full text-left p-8 focus:outline-none"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <span className="block text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-black text-slate-900 dark:text-white text-2xl tracking-tight">{isToday ? t.hari_ini : d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric' })}</span>
                                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-blue-600" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-black text-blue-600">{progress}%</div>
                                                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">{t.selesai}</div>
                                                    </div>
                                                </div>

                                                <div className="w-full bg-slate-100 dark:bg-slate-900 h-4 rounded-full overflow-hidden p-1 mt-6">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="bg-blue-600 h-full rounded-full shadow-lg shadow-blue-600/20" />
                                                </div>
                                            </button>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="px-8 pb-8 pt-2 bg-slate-50/50 dark:bg-slate-900/30"
                                                    >
                                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-3">
                                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 text-center">{t.detail_tugas}</h5>
                                                            {habits.length === 0 ? (
                                                                <p className="text-center text-slate-400 text-xs italic">{t.belum_ada_data}</p>
                                                            ) : (
                                                                habits.map(habit => {
                                                                    const habitDone = doneIds.includes(habit.id);
                                                                    return (
                                                                        <div key={habit.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100/50 dark:border-slate-700/50 shadow-sm">
                                                                            {habitDone ? (
                                                                                <div className="bg-green-100 dark:bg-green-900/20 p-1 rounded-lg">
                                                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                                                                                    <Circle className="w-4 h-4 text-slate-300" />
                                                                                </div>
                                                                            )}
                                                                            <span className={cn(
                                                                                "text-sm font-bold",
                                                                                habitDone ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-600"
                                                                            )}>
                                                                                {habit.text}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </main>

                <nav className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-sm px-6 z-50">
                    <div className="bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-3xl shadow-2xl rounded-[3rem] p-4 flex items-center justify-between border border-white/10">
                        <button onClick={() => setActiveTab('today')}
                            className={cn("flex items-center justify-center gap-3 py-5 px-10 rounded-[2.5rem] transition-all duration-500 font-black text-sm", activeTab === 'today' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-500 hover:text-white')}>
                            <LayoutGrid className="w-6 h-6" />
                            {activeTab === 'today' && <span>{t.target.toUpperCase()}</span>}
                        </button>
                        <button onClick={() => setActiveTab('history')}
                            className={cn("flex items-center justify-center gap-3 py-5 px-10 rounded-[2.5rem] transition-all duration-500 font-black text-sm", activeTab === 'history' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-500 hover:text-white')}>
                            <History className="w-6 h-6" />
                            {activeTab === 'history' && <span>{t.riwayat.toUpperCase()}</span>}
                        </button>
                    </div>
                </nav>
            </div>
        </div>
    );
}
