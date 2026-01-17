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
    ChevronUp,
    FileText,
    Edit3,
    X,
    Copy
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db, auth, googleProvider } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider } from 'firebase/auth';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Habit {
    id: string;
    text: string;
    createdAt?: string;
}

export default function HabitTracker() {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
    const [habits, setHabits] = useState<Habit[]>([]);
    const [completions, setCompletions] = useState<{ [date: string]: string[] }>({});
    const [notes, setNotes] = useState<{ [date: string]: string }>({});
    const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);
    const [tempNote, setTempNote] = useState('');
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
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        details?: string;
        onConfirm: () => void;
    } | null>(null);

    const t = {
        id: {
            halo: 'Halo,',
            cloud_active: 'Cloud Aktif',
            syncing: 'Sinkron...',
            terhubung: 'Terhubung',
            offline: 'Offline',
            target: 'Target',
            hari: 'Apa Targetmu',
            hari_ini: 'Hari Ini',
            terpilih: 'Hari Ini?',
            placeholder: 'Tulis target baru Anda...',
            belum_ada_data: 'Belum ada data di cloud.',
            riwayat: 'Riwayat',
            perjalanan: 'Project History',
            selesai: 'Selesai',
            keluar: 'Keluar',
            tersimpan: 'Tersimpan',
            tagline: 'Setiap perubahan yang berarti dimulai dari kebiasaan kecil — mulailah dengan lembut hari ini, dan biarkan konsistensi membentuk dirimu.',
            mulai: 'Mulai dengan Google',
            detail_tugas: 'Detail Tugas',
            semua_tugas: 'Semua Tugas Terdata',
            tutup: 'Tutup',
            reset_filter: 'Lihat 7 Hari Terakhir',
            pilih_tanggal: 'Pilih tanggal di kalender untuk filter',
            catatan_harian: 'Catatan Harian',
            tambah_catatan: 'Tambah Catatan',
            edit_catatan: 'Edit Catatan',
            simpan: 'Simpan',
            batal: 'Batal',
            tulis_catatan: 'Tulis evaluasi atau catatan hari ini...',
            signup: 'Daftar dengan Google',
            tidak_ada_catatan: 'Tidak ada catatan untuk hari ini.',
            konfirmasi_salin: 'Konfirmasi Salin',
            pesan_salin_banyak: 'Salin semua tugas dari tanggal ini ke daftar tugas hari ini?',
            konfirmasi_salin_satu: 'Salin Tugas',
            pesan_salin_satu: 'Salin tugas ini ke hari ini?',
            ya: 'Ya, Salin',
        },
        en: {
            halo: 'Hello,',
            cloud_active: 'Cloud Active',
            syncing: 'Syncing...',
            terhubung: 'Connected',
            offline: 'Offline',
            target: 'Today\'s',
            hari: 'What\'s Your Target',
            hari_ini: 'Today',
            terpilih: 'Today?',
            placeholder: 'Write your new target...',
            belum_ada_data: 'No data in the cloud yet.',
            riwayat: 'Progress',
            perjalanan: 'Project History',
            selesai: 'Done',
            keluar: 'Logout',
            tersimpan: 'Saved',
            tagline: 'Every meaningful change begins with a small habit — start gently today, and let consistency shape who you become.',
            mulai: 'Start with Google',
            detail_tugas: 'Task Details',
            semua_tugas: 'All Recorded Tasks',
            tutup: 'Close',
            reset_filter: 'Show Last 7 Days',
            pilih_tanggal: 'Click a date in calendar to filter',
            catatan_harian: 'Daily Note',
            tambah_catatan: 'Add Note',
            edit_catatan: 'Edit Note',
            simpan: 'Save',
            batal: 'Cancel',
            tulis_catatan: 'Write today\'s evaluation or notes...',
            signup: 'Sign up with Google',
            tidak_ada_catatan: 'No notes for today.',
            konfirmasi_salin: 'Confirm Copy',
            pesan_salin_banyak: 'Copy all tasks from this date to today\'s list?',
            konfirmasi_salin_satu: 'Copy Task',
            pesan_salin_satu: 'Copy this task to today?',
            ya: 'Yes, Copy',
        }
    }[language];

    const formatDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getTodayDate = () => formatDateKey(new Date());
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
            const localNotes = localStorage.getItem('local_notes_fallback');

            if (localHabits) setHabits(JSON.parse(localHabits));
            if (localCompletions) setCompletions(JSON.parse(localCompletions));
            if (localNotes) setNotes(JSON.parse(localNotes));

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
                    let loadedHabits: Habit[] = data.habits;
                    const hasLegacy = loadedHabits.some(h => !h.createdAt);
                    if (hasLegacy) {
                        const todayStr = formatDateKey(new Date());
                        loadedHabits = loadedHabits.map(h => ({
                            ...h,
                            createdAt: h.createdAt || todayStr
                        }));
                        // Auto-migrate legacy data
                        setDoc(userDocRef, { habits: loadedHabits }, { merge: true });
                    }
                    setHabits(loadedHabits);
                    localStorage.setItem('local_habits_fallback', JSON.stringify(loadedHabits));
                }
                if (data.completions) {
                    setCompletions(data.completions);
                    localStorage.setItem('local_completions_fallback', JSON.stringify(data.completions));
                }
                if (data.notes) {
                    setNotes(data.notes);
                    localStorage.setItem('local_notes_fallback', JSON.stringify(data.notes));
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

    const saveToFirebase = async (newHabits: Habit[], newCompletions: { [date: string]: string[] }, newNotes: { [date: string]: string }) => {
        if (!user || !isDataLoaded) return; // CRITICAL: Stop save if data haven't loaded from cloud yet

        setIsSyncing(true);
        try {
            // Also update local fallback immediatey
            localStorage.setItem('local_habits_fallback', JSON.stringify(newHabits));
            localStorage.setItem('local_completions_fallback', JSON.stringify(newCompletions));
            localStorage.setItem('local_notes_fallback', JSON.stringify(newNotes));

            await setDoc(doc(db, 'users', user.uid), {
                habits: newHabits,
                completions: newCompletions,
                notes: newNotes,
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

    const signupWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error('Signup error:', err);
            setError('Gagal mendaftar dengan Google.');
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

        const habit = { id: Date.now().toString(), text: newHabit.trim(), createdAt: today };
        const updatedHabits = [...habits, habit];

        // Optimistic UI update
        setHabits(updatedHabits);
        setNewHabit('');

        await saveToFirebase(updatedHabits, completions, notes);
    };

    const deleteHabit = async (id: string) => {
        const updatedHabits = habits.filter(h => h.id !== id);
        setHabits(updatedHabits);
        await saveToFirebase(updatedHabits, completions, notes);
    };

    const toggleHabit = async (id: string, date = today) => {
        const currentDayIds = completions[date] || [];
        const isNowDone = !currentDayIds.includes(id);

        const newDayIds = isNowDone
            ? [...currentDayIds, id]
            : currentDayIds.filter(hid => hid !== id);

        const newCompletions = { ...completions, [date]: newDayIds };
        setCompletions(newCompletions);
        await saveToFirebase(habits, newCompletions, notes);
    };

    const saveNote = async (date: string) => {
        const newNotes = { ...notes, [date]: tempNote };
        setNotes(newNotes);
        setEditingNoteDate(null);
        await saveToFirebase(habits, completions, newNotes);
    };

    const copyTaskToToday = async (text: string) => {
        const habit = { id: Date.now().toString(), text: text, createdAt: today };
        const updatedHabits = [...habits, habit];
        setHabits(updatedHabits);
        await saveToFirebase(updatedHabits, completions, notes);
    };

    const copyAllTasksToToday = async (date: string) => {
        const sourceHabits = habits.filter(h => h.createdAt === date);
        if (sourceHabits.length === 0) return;

        const newHabits = sourceHabits.map((h, i) => ({
            id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
            text: h.text,
            createdAt: today
        }));

        const updatedHabits = [...habits, ...newHabits];
        setHabits(updatedHabits);
        await saveToFirebase(updatedHabits, completions, notes);

        // Show feedback or switch tab? 
        // Simple feedback via alert or toast would be nice but for now just the action
        setActiveTab('today');
    };

    const getProgress = (date: string) => {
        const dateHabits = habits.filter(h => h.createdAt === date);
        if (dateHabits.length === 0) return 0;
        const doneCount = dateHabits.filter(h => (completions[date] || []).includes(h.id)).length;
        return Math.round((doneCount / dateHabits.length) * 100);
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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6 md:p-12">
                <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-center md:text-left max-w-sm mx-auto md:mx-0"
                    >
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center mx-auto md:mx-0 mb-8 shadow-2xl shadow-blue-500/20 p-2">
                            <img
                                src="/rabbit.png"
                                alt="Rabbit Logo"
                                className="w-full h-full object-contain mix-blend-multiply dark:invert dark:mix-blend-screen opacity-90"
                            />
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter">
                            Rabbit Tracker
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-10 text-lg leading-relaxed font-medium">
                            {t.tagline}
                        </p>
                        <div className="w-full space-y-4">
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
                            <button
                                onClick={signupWithGoogle}
                                className="w-full flex items-center justify-center gap-4 bg-blue-600 text-white font-bold py-5 px-8 rounded-3xl shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:bg-blue-700 transition-all active:scale-[0.98] text-lg"
                            >
                                <div className="bg-white rounded-full p-1 opacity-90">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                </div>
                                {t.signup}
                            </button>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="w-full max-w-sm mx-auto md:max-w-none"
                    >
                        <p className="text-center md:text-left text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-6">
                            Loved by simple people
                        </p>
                        <div className="space-y-4">
                            {[
                                {
                                    name: "Sarah Jenkins",
                                    role: "Product Manager at TechFlow",
                                    text: "Rabbit Tracker changed how I view my daily progress. Simple, effectively beautiful.",
                                    initial: "S",
                                    color: "bg-pink-500"
                                },
                                {
                                    name: "David Chen",
                                    role: "Freelance Designer",
                                    text: "The cleanest habit tracker I've ever used. The visual feedback is incredibly satisfying.",
                                    initial: "D",
                                    color: "bg-indigo-500"
                                },
                                {
                                    name: "Marcus Thompson",
                                    role: "Senior Developer",
                                    text: "Finally, a tracker that doesn't feel like a chore. It just works.",
                                    initial: "M",
                                    color: "bg-emerald-500"
                                }
                            ].map((testimonial, i) => (
                                <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-lg shadow-blue-900/5 border border-slate-100 dark:border-slate-700 flex items-start gap-4 hover:scale-[1.02] transition-transform duration-300">
                                    <div className={`w-10 h-10 rounded-full ${testimonial.color} flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20`}>
                                        <span className="text-white font-bold text-sm">{testimonial.initial}</span>
                                    </div>
                                    <div>
                                        <p className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed mb-2.5">
                                            "{testimonial.text}"
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-900 dark:text-white text-xs font-bold">{testimonial.name}</span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                            <span className="text-slate-400 text-[10px] font-medium">{testimonial.role}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background transition-colors duration-500 pb-40">
            <div className="max-w-2xl mx-auto px-6 pt-10 relative">
                <header className="flex justify-between items-center mb-6 md:mb-12">
                    <div className="flex items-center gap-4 md:gap-5">
                        <div className="relative hidden md:block">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="User" className="w-10 h-10 md:w-14 md:h-14 rounded-3xl shadow-xl border-4 border-white dark:border-slate-800 object-cover" />
                            ) : (
                                <div className="w-10 h-10 md:w-14 md:h-14 bg-blue-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center">
                                    <UserIcon className="text-blue-600 w-5 h-5 md:w-7 md:h-7" />
                                </div>
                            )}
                            {(isSyncing || dataLoading) && (
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 md:border-4 border-white dark:border-slate-900 shadow-lg z-10">
                                    <RefreshCw className="w-2 h-2 md:w-2.5 md:h-2.5 text-white" />
                                </motion.div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 hidden md:flex">
                                <h2 className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Rabbit Hub</h2>
                                {dataLoading ? (
                                    <span className="text-[8px] md:text-[10px] text-blue-500 font-bold uppercase animate-pulse">{t.syncing}</span>
                                ) : error ? (
                                    <span className="text-[8px] md:text-[10px] text-red-500 font-bold uppercase flex items-center gap-1">
                                        <AlertCircle className="w-2.5 h-2.5" /> {t.offline}
                                    </span>
                                ) : (
                                    <span className="text-[8px] md:text-[10px] text-green-500 font-bold uppercase flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" /> {t.cloud_active}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate max-w-[180px] md:max-w-none">{user.displayName}</h1>
                            <div className="flex flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-2 mt-0.5">
                                <p className="text-[10px] md:text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[140px] md:max-w-none">{user.email}</p>
                                {lastSynced && !error && (
                                    <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-tighter italic">{t.tersimpan} {lastSynced}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <button onClick={toggleLanguage}
                            className="p-2 md:p-4 bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-all border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl group flex items-center gap-2">
                            <Languages className="w-5 h-5 md:w-6 md:h-6" />
                            <span className="text-[10px] font-black group-hover:block hidden">{language.toUpperCase()}</span>
                        </button>
                        <button onClick={() => setIsDarkMode(!isDarkMode)}
                            className="p-2 md:p-4 bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-all border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl">
                            {isDarkMode ? <Sun className="w-5 h-5 md:w-6 md:h-6" /> : <Moon className="w-5 h-5 md:w-6 md:h-6" />}
                        </button>
                        <button onClick={handleLogout}
                            className="p-2 md:p-4 bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl text-slate-500 dark:text-slate-400 hover:text-red-600 transition-all border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl">
                            <LogOut className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </header>

                <main>
                    {error && (
                        <div className="mb-6 md:mb-8 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 p-4 md:p-5 rounded-3xl flex items-center gap-4 text-red-600 dark:text-red-400 text-sm font-bold shadow-lg shadow-red-200/20">
                            <AlertCircle className="w-5 h-5 md:w-6 md:h-6 shrink-0" />
                            {error}
                        </div>
                    )}

                    {activeTab === 'today' ? (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 md:space-y-10">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 font-bold text-sm md:text-base uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                    <h3 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                                        {t.hari} <span className="text-blue-600">{t.terpilih}</span>
                                    </h3>
                                </div>
                                <div className="flex items-center gap-5 bg-white dark:bg-slate-800 p-4 pr-6 rounded-[2rem] shadow-lg shadow-blue-500/5 border border-slate-100 dark:border-slate-700">
                                    <div className="relative w-16 h-16 flex items-center justify-center">
                                        <svg className="w-full h-full -rotate-90 transform">
                                            <circle cx="32" cy="32" r="28" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="6" fill="none" />
                                            <circle cx="32" cy="32" r="28"
                                                className={cn("transition-all duration-1000 ease-out", getProgress(today) > 50 ? "stroke-blue-600" : "stroke-orange-500")}
                                                strokeWidth="6" fill="none"
                                                strokeDasharray="175.9"
                                                strokeDashoffset={175.9 - (175.9 * getProgress(today)) / 100}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            {getProgress(today) === 100 ? (
                                                <div className="bg-green-500 rounded-full p-1.5 animate-in zoom-in">
                                                    <Check className="w-6 h-6 text-white" />
                                                </div>
                                            ) : (
                                                <span className="text-xs font-black text-slate-400">{getProgress(today)}%</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t.selesai}</span>
                                        <span className={cn("text-2xl font-black leading-none", getProgress(today) > 50 ? "text-blue-600" : "text-orange-500")}>
                                            {getProgress(today) === 100 ? "Great Job!" : "Keep Going"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={addHabit} className="relative group">
                                <input type="text" value={newHabit} onChange={(e) => setNewHabit(e.target.value)} placeholder={t.placeholder}
                                    className="w-full bg-white dark:bg-slate-800 border-none shadow-2xl shadow-blue-200/40 dark:shadow-none rounded-[2rem] md:rounded-[2.5rem] py-6 md:py-8 px-6 md:px-10 pr-16 md:pr-20 focus:ring-4 focus:ring-blue-500/10 outline-none text-slate-700 dark:text-white text-lg md:text-xl font-medium transition-all" />
                                <button type="submit" className="absolute right-3 top-3 bottom-3 md:right-4 md:top-4 md:bottom-4 aspect-square bg-blue-600 text-white rounded-[1.5rem] md:rounded-[1.8rem] flex items-center justify-center hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 active:scale-90">
                                    <Plus className="w-6 h-6 md:w-8 md:h-8" />
                                </button>
                            </form>

                            <div className="space-y-4 md:space-y-5">
                                <AnimatePresence mode="popLayout">
                                    {habits.filter(h => h.createdAt === today).length === 0 ? (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 md:py-24 border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem]">
                                            <div className="w-20 h-20 mx-auto mb-6 opacity-50 grayscale">
                                                <img
                                                    src="/rabbit.png"
                                                    alt="No Data"
                                                    className="w-full h-full object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                                                />
                                            </div>
                                            <p className="text-slate-400 font-bold text-lg md:text-xl">{t.belum_ada_data}</p>
                                        </motion.div>
                                    ) : (
                                        habits.filter(h => h.createdAt === today).sort((a, b) => {
                                            const isADone = (completions[today] || []).includes(a.id);
                                            const isBDone = (completions[today] || []).includes(b.id);
                                            return (isADone === isBDone) ? 0 : isADone ? 1 : -1;
                                        }).map((habit) => {
                                            const isDone = (completions[today] || []).includes(habit.id);
                                            return (
                                                <motion.div key={habit.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                                    className={cn("group flex items-center p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] transition-all duration-300 border-2", isDone ? "bg-blue-600 border-blue-600 shadow-2xl shadow-blue-500/30" : "bg-white dark:bg-slate-800 border-transparent shadow-sm hover:shadow-xl dark:hover:border-slate-700")}>
                                                    <button onClick={() => toggleHabit(habit.id)} className="mr-4 md:mr-6 focus:outline-none shrink-0">
                                                        {isDone ? <div className="bg-white rounded-2xl p-1.5"><CheckCircle2 className="text-blue-600 w-8 h-8 md:w-10 md:h-10" /></div> : <Circle className="text-slate-200 dark:text-slate-700 w-8 h-8 md:w-10 md:h-10 hover:text-blue-500 transition-colors" />}
                                                    </button>
                                                    <span className={cn("flex-1 font-extrabold text-lg md:text-2xl transition-all", isDone ? "text-white/80 line-through" : "text-slate-800 dark:text-slate-100")}>{habit.text}</span>
                                                    <button onClick={() => deleteHabit(habit.id)} className={cn("p-3 md:p-4 rounded-2xl transition-all", isDone ? "text-white/40 hover:text-white" : "opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500")}>
                                                        <Trash2 className="w-5 h-5 md:w-6 md:h-6" />
                                                    </button>
                                                </motion.div>
                                            );
                                        })
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 md:space-y-10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-tighter">
                                    {t.riwayat} <span className="text-blue-600">{language === 'en' ? 'History' : 'Projek'}</span>
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
                                    <Calendar className="w-5 h-5 md:w-6 md:h-6" />
                                </button>
                            </div>

                            <AnimatePresence>
                                {showCalendar && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-white dark:bg-slate-800 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden"
                                    >
                                        <div className="flex justify-between items-center mb-4 md:mb-6">
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() - 1)))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                                <ChevronLeft className="w-5 h-5 text-slate-400" />
                                            </button>
                                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs md:text-sm">
                                                {calendarMonth.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })}
                                            </h4>
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() + 1)))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                                <ChevronRight className="w-5 h-5 text-slate-400" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1 md:gap-2">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                                <div key={i} className="text-[8px] md:text-[10px] font-black text-slate-300 dark:text-slate-600 text-center py-2">{day}</div>
                                            ))}
                                            {(() => {
                                                const days = [];
                                                const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
                                                const numDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();

                                                for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);

                                                for (let i = 1; i <= numDays; i++) {
                                                    const currentDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i);
                                                    const dateStr = formatDateKey(currentDay);
                                                    const progress = getProgress(dateStr);
                                                    const isToday = dateStr === today;
                                                    const isSelected = selectedDate === dateStr;

                                                    const getProgressColor = (p: number, type: 'bg' | 'text' | 'border' | 'ring') => {
                                                        if (p === 100) return type === 'bg' ? 'bg-green-500' : type === 'text' ? 'text-green-600' : type === 'border' ? 'border-green-500' : 'ring-green-500/20';
                                                        if (p > 50) return type === 'bg' ? 'bg-blue-500' : type === 'text' ? 'text-blue-600' : type === 'border' ? 'border-blue-600' : 'ring-blue-500/20';
                                                        if (p > 0) return type === 'bg' ? 'bg-orange-500' : type === 'text' ? 'text-orange-500' : type === 'border' ? 'border-orange-500' : 'ring-orange-500/20';
                                                        // Default (0% or just active state for empty days)
                                                        return type === 'bg' ? 'bg-slate-100 dark:bg-slate-900' : type === 'text' ? 'text-slate-600 dark:text-slate-400' : type === 'border' ? 'border-blue-600' : 'ring-blue-500/20';
                                                    };

                                                    const activeColorText = progress > 0 ? getProgressColor(progress, 'text') : 'text-blue-600';
                                                    const activeColorBorder = progress > 0 ? getProgressColor(progress, 'border') : 'border-blue-600';
                                                    const activeColorRing = progress > 0 ? getProgressColor(progress, 'ring') : 'ring-blue-500/20';

                                                    days.push(
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                setSelectedDate(isSelected ? null : dateStr);
                                                                setExpandedDate(dateStr);
                                                            }}
                                                            className={cn(
                                                                "relative aspect-square flex flex-col items-center justify-center rounded-lg md:rounded-xl transition-all group overflow-hidden border-2",
                                                                isSelected ? `${activeColorBorder} ring-2 ${activeColorRing}` : "border-transparent"
                                                            )}
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "absolute inset-0 transition-all opacity-20",
                                                                    getProgressColor(progress, 'bg')
                                                                )}
                                                                style={{ height: `${progress}%`, top: 'auto' }}
                                                            />
                                                            <span className={cn(
                                                                "relative z-10 text-[10px] md:text-xs font-bold",
                                                                isToday ? `${activeColorText} underline decoration-2 underline-offset-4` :
                                                                    isSelected ? activeColorText : "text-slate-600 dark:text-slate-400"
                                                            )}>
                                                                {i}
                                                            </span>
                                                            {progress > 0 && (
                                                                <span className={cn(
                                                                    "relative z-10 text-[6px] md:text-[8px] font-black leading-none mt-0.5",
                                                                    progress > 50 ? "text-blue-600 dark:text-blue-400" : "text-orange-500 dark:text-orange-400"
                                                                )}>{progress}%</span>
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

                            <div className="grid gap-4 md:gap-6 pb-20">
                                {selectedDate && (
                                    <div className="flex justify-between items-center mb-2 px-2">
                                        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">{t.pilih_tanggal}</p>
                                        <button
                                            onClick={() => { setSelectedDate(null); setExpandedDate(null); }}
                                            className="text-[10px] md:text-xs font-black text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl transition-all"
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
                                    const dateKey = formatDateKey(d);
                                    const progress = getProgress(dateKey);
                                    const isToday = dateKey === today;
                                    const isExpanded = expandedDate === dateKey;
                                    const doneIds = completions[dateKey] || [];
                                    const borderColor = progress === 100 ? 'border-green-500/20' : progress > 50 ? 'border-blue-600/20' : progress > 0 ? 'border-orange-500/20' : 'border-blue-600/20';
                                    const ringColor = progress === 100 ? 'ring-green-500/10' : progress > 50 ? 'ring-blue-500/10' : progress > 0 ? 'ring-orange-500/10' : 'ring-blue-500/10';
                                    const chevronColor = progress === 100 ? 'text-green-500' : progress > 50 ? 'text-blue-600' : progress > 0 ? 'text-orange-500' : 'text-blue-600';

                                    return (
                                        <div
                                            key={dateKey}
                                            className={cn(
                                                "rounded-[2rem] md:rounded-[3rem] shadow-sm border-2 transition-all overflow-hidden",
                                                isToday ? `bg-white dark:bg-slate-800 ${borderColor}` : "bg-white dark:bg-slate-800 border-transparent",
                                                isExpanded && `ring-4 ${ringColor}`
                                            )}
                                        >
                                            <button
                                                onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                                                className="w-full text-left p-6 md:p-8 focus:outline-none"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <span className="block text-[8px] md:text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })}</span>
                                                        <div className="flex items-center gap-2 md:gap-3">
                                                            <span className="font-black text-slate-900 dark:text-white text-xl md:text-2xl tracking-tight">{isToday ? t.hari_ini : d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric' })}</span>
                                                            {isExpanded ? <ChevronUp className={cn("w-4 h-4 md:w-5 md:h-5", chevronColor)} /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-slate-300" />}
                                                        </div>
                                                    </div>

                                                    {!isToday && habits.filter(h => h.createdAt === dateKey).length > 0 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConfirmation({
                                                                    isOpen: true,
                                                                    title: t.konfirmasi_salin,
                                                                    message: t.pesan_salin_banyak,
                                                                    details: `${d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })} • ${habits.filter(h => h.createdAt === dateKey).length} Tasks`,
                                                                    onConfirm: () => copyAllTasksToToday(dateKey)
                                                                });
                                                            }}
                                                            className="p-3 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95"
                                                            title="Salin semua ke Hari Ini"
                                                        >
                                                            <Copy className="w-4 h-4 md:w-5 md:h-5" />
                                                        </button>
                                                    )}

                                                    <div className="text-right">
                                                        <div className={cn("text-xl md:text-2xl font-black flex items-center gap-2 justify-end", progress > 50 ? "text-blue-600" : "text-orange-500")}>
                                                            <span>{progress}%</span>
                                                            <span className="text-sm md:text-base text-slate-300 dark:text-slate-600">/</span>
                                                            <span className="text-sm md:text-base text-slate-400 dark:text-slate-500">{habits.filter(h => h.createdAt === dateKey).length}</span>
                                                        </div>
                                                        <div className="text-[8px] md:text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">{t.selesai}</div>
                                                    </div>
                                                </div>

                                                <div className="w-full bg-slate-100 dark:bg-slate-900 h-3 md:h-4 rounded-full overflow-hidden p-1 mt-4 md:mt-6">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className={cn("h-full rounded-full shadow-lg", progress > 50 ? "bg-blue-600 shadow-blue-600/20" : "bg-orange-500 shadow-orange-500/20")} />
                                                </div>
                                            </button>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="px-6 pb-6 pt-2 md:px-8 md:pb-8 bg-slate-50/50 dark:bg-slate-900/30"
                                                    >
                                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 md:pt-6 space-y-2 md:space-y-3">
                                                            <h5 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 md:mb-4 text-center">{t.detail_tugas}</h5>
                                                            {habits.filter(h => h.createdAt === dateKey).length === 0 ? (
                                                                <p className="text-center text-slate-400 text-xs italic">{t.belum_ada_data}</p>
                                                            ) : (
                                                                habits.filter(h => h.createdAt === dateKey).map(habit => {
                                                                    const habitDone = doneIds.includes(habit.id);
                                                                    return (
                                                                        <div key={habit.id} className="group flex items-center gap-3 p-2.5 md:p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100/50 dark:border-slate-700/50 shadow-sm relative pr-12 transition-all hover:shadow-md">
                                                                            {habitDone ? (
                                                                                <div className="bg-green-100 dark:bg-green-900/20 p-1 rounded-lg shrink-0">
                                                                                    <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600" />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg shrink-0">
                                                                                    <Circle className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300" />
                                                                                </div>
                                                                            )}
                                                                            <span className={cn(
                                                                                "text-xs md:text-sm font-bold truncate w-full",
                                                                                habitDone ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-600"
                                                                            )}>
                                                                                {habit.text}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => setConfirmation({
                                                                                    isOpen: true,
                                                                                    title: t.konfirmasi_salin_satu,
                                                                                    message: t.pesan_salin_satu,
                                                                                    details: `${d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })} • 1 Task`,
                                                                                    onConfirm: () => copyTaskToToday(habit.text)
                                                                                })}
                                                                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all rounded-xl"
                                                                                title="Salin ke Hari Ini"
                                                                            >
                                                                                <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}

                                                        </div>

                                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 md:pt-6">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <h5 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.catatan_harian}</h5>
                                                                {!editingNoteDate && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingNoteDate(dateKey);
                                                                            setTempNote(notes[dateKey] || '');
                                                                        }}
                                                                        className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl transition-all"
                                                                    >
                                                                        {notes[dateKey] ? <Edit3 className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <FileText className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                                                                        {notes[dateKey] ? t.edit_catatan : t.tambah_catatan}
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {editingNoteDate === dateKey ? (
                                                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                                                    <textarea
                                                                        value={tempNote}
                                                                        onChange={(e) => setTempNote(e.target.value)}
                                                                        placeholder={t.tulis_catatan}
                                                                        className="w-full h-24 md:h-32 bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-5 text-sm md:text-base text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none border border-slate-200 dark:border-slate-700"
                                                                    />
                                                                    <div className="flex gap-2 justify-end">
                                                                        <button
                                                                            onClick={() => setEditingNoteDate(null)}
                                                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                            {t.batal}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => saveNote(dateKey)}
                                                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                                                                        >
                                                                            <Check className="w-3.5 h-3.5" />
                                                                            {t.simpan}
                                                                        </button>
                                                                    </div>
                                                                </motion.div>
                                                            ) : (
                                                                notes[dateKey] ? (
                                                                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 md:p-5 rounded-2xl text-slate-700 dark:text-slate-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
                                                                        {notes[dateKey]}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                                                                        <p className="text-slate-400 text-xs italic">{t.tidak_ada_catatan}</p>
                                                                    </div>
                                                                )
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

                <nav className="fixed bottom-5 md:bottom-12 left-1/2 -translate-x-1/2 w-full max-w-sm px-6 z-50">
                    <div className="bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-3xl shadow-2xl rounded-[2.5rem] md:rounded-[3rem] p-2 md:p-4 grid grid-cols-2 gap-2 border border-white/10">
                        <button onClick={() => setActiveTab('today')}
                            className={cn("w-full flex items-center justify-center gap-2 md:gap-3 py-3 px-5 md:py-5 md:px-10 rounded-[2rem] md:rounded-[2.5rem] transition-all duration-500 font-black text-xs md:text-sm", activeTab === 'today' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-500 hover:text-white')}>
                            <LayoutGrid className="w-5 h-5 md:w-6 md:h-6" />
                            {activeTab === 'today' && <span>{t.target.toUpperCase()}</span>}
                        </button>
                        <button onClick={() => setActiveTab('history')}
                            className={cn("w-full flex items-center justify-center gap-2 md:gap-3 py-3 px-5 md:py-5 md:px-10 rounded-[2rem] md:rounded-[2.5rem] transition-all duration-500 font-black text-xs md:text-sm", activeTab === 'history' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-500 hover:text-white')}>
                            <History className="w-5 h-5 md:w-6 md:h-6" />
                            {activeTab === 'history' && <span>{t.riwayat.toUpperCase()}</span>}
                        </button>
                    </div>
                </nav>
            </div>

            <AnimatePresence>
                {confirmation && confirmation.isOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setConfirmation(null)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl relative z-10 border border-slate-100 dark:border-slate-700"
                        >
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{confirmation.title}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-2 leading-relaxed">{confirmation.message}</p>
                            {confirmation.details && (
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl mb-6 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800 flex items-center gap-2 justify-center">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {confirmation.details}
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmation(null)}
                                    className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    {t.batal}
                                </button>
                                <button
                                    onClick={() => { confirmation.onConfirm(); setConfirmation(null); }}
                                    className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all"
                                >
                                    {t.ya}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
