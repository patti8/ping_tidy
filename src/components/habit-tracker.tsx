'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
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
    Copy,
    Square,
    GripVertical,
    Zap,
    Loader2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db, auth, googleProvider } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider } from 'firebase/auth';
import { suggestTaskDetails, identifyPriorityTask, generateMorningBriefing, MorningBriefing } from '@/lib/gemini';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Habit {
    id: string;
    text: string;
    createdAt?: string;
    emoji?: string;
    category?: string;
    isAiAnalyzing?: boolean;
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
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
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
        tasks?: Habit[];
        onConfirm: (selectedIds?: string[]) => void;
    } | null>(null);
    const [selectedTasksToCopy, setSelectedTasksToCopy] = useState<string[]>([]);
    const [thinkingFrog, setThinkingFrog] = useState(false);
    const [priorityTaskId, setPriorityTaskId] = useState<string | null>(null);
    const [morningBriefing, setMorningBriefing] = useState<MorningBriefing | null>(null);
    const [loadingBriefing, setLoadingBriefing] = useState(false);

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
            pesan_salin_banyak: 'Pilih tugas yang ingin disalin ke hari ini:',
            konfirmasi_salin_satu: 'Salin Tugas',
            pesan_salin_satu: 'Salin tugas ini ke hari ini?',
            ya: 'Salin Terpilih',
            pilih_semua: 'Pilih Semua'
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
            pesan_salin_banyak: 'Select tasks to copy to today\'s list:',
            konfirmasi_salin_satu: 'Copy Task',
            pesan_salin_satu: 'Copy this task to today?',
            ya: 'Copy Selected',
            pilih_semua: 'Select All'
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
                let currentCompletions = data.completions || {};
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

                    // Sort: Today's habits (Unchecked First), maintaining relative drag order
                    const todayStr = formatDateKey(new Date());
                    const todayHabits = loadedHabits.filter(h => h.createdAt === todayStr);
                    const otherHabits = loadedHabits.filter(h => h.createdAt !== todayStr);

                    const sortedToday = [...todayHabits].sort((a, b) => {
                        // 1. Priority Task Floating
                        if (priorityTaskId) {
                            if (a.id === priorityTaskId) return -1;
                            if (b.id === priorityTaskId) return 1;
                        }

                        // 2. Unchecked First
                        const aDone = (currentCompletions[todayStr] || []).includes(a.id);
                        const bDone = (currentCompletions[todayStr] || []).includes(b.id);
                        if (aDone === bDone) return 0;
                        return aDone ? 1 : -1;
                    });

                    const finalHabits = [...otherHabits, ...sortedToday];

                    setHabits(finalHabits);
                    localStorage.setItem('local_habits_fallback', JSON.stringify(finalHabits));
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
                if (data.tutorialSeen === undefined || data.tutorialSeen === false) {
                    setShowTutorial(true);
                }
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
    }, [user, priorityTaskId]); // Add priorityTaskId to dependency to re-sort when it changes

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

    // 4. Morning Briefing Effect
    useEffect(() => {
        const fetchBriefing = async () => {
            if (!user || !isDataLoaded) return;

            const todayKey = getTodayDate();
            const storageKey = `pingtidy_briefing_${todayKey}_${user.uid}_${language}`; // Add language to key
            const cached = localStorage.getItem(storageKey);

            if (cached) {
                setMorningBriefing(JSON.parse(cached));
                return;
            }

            // Only generate if we have some history or at least today's context, 
            // but we don't want to block if habits are empty (user might need motivation to start).
            // However, we need to ensure habits are loaded. isDataLoaded ensures that.

            if (loadingBriefing) return;

            setLoadingBriefing(true);

            // Calculate Yesterday's Stats
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = formatDateKey(yesterday);

            const yesterdayHabitsList = habits.filter(h => h.createdAt === yesterdayKey);
            const yesterdayTotal = yesterdayHabitsList.length;
            const yesterdayCompletedIds = completions[yesterdayKey] || [];
            const yesterdayCompletedCount = yesterdayHabitsList.filter(h => yesterdayCompletedIds.includes(h.id)).length;

            const yesterdayRate = yesterdayTotal > 0 ? yesterdayCompletedCount / yesterdayTotal : 0;

            const todayHabitsList = habits.filter(h => h.createdAt === todayKey).map(h => h.text);

            const result = await generateMorningBriefing(
                user.displayName || 'Friend',
                yesterdayRate,
                yesterdayTotal,
                todayHabitsList,
                language // Pass language
            );

            if (result) {
                setMorningBriefing(result);
                localStorage.setItem(storageKey, JSON.stringify(result));
            }
            setLoadingBriefing(false);
        };

        // Delay slightly to ensure UI is settled
        const timer = setTimeout(fetchBriefing, 1000);
        return () => clearTimeout(timer);
    }, [user, isDataLoaded, habits.length, language]); // Re-run when language changes

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

        const habitId = Date.now().toString();
        // Initial habit with loading state for AI
        const habit: Habit = {
            id: habitId,
            text: newHabit.trim(),
            createdAt: today,
            isAiAnalyzing: true
        };

        // Insert new habit at the beginning of today's list (active habits at top)
        const otherHabits = habits.filter(h => h.createdAt !== today);
        const todayHabits = habits.filter(h => h.createdAt === today);
        let updatedHabits = [...otherHabits, habit, ...todayHabits];

        // Optimistic UI update
        setHabits(updatedHabits);
        setNewHabit('');

        // Save initial state
        await saveToFirebase(updatedHabits, completions, notes);

        // Call Gemini AI for Smart Emoji & Label
        try {
            const suggestion = await suggestTaskDetails(habit.text);

            // Update the specific habit with AI results
            updatedHabits = updatedHabits.map(h => {
                if (h.id === habitId) {
                    return {
                        ...h,
                        emoji: suggestion.emoji,
                        category: suggestion.category,
                        isAiAnalyzing: false
                    };
                }
                return h;
            });

            setHabits(updatedHabits);
            await saveToFirebase(updatedHabits, completions, notes);
        } catch (error) {
            console.error("AI Auto-label failed:", error);
            // Remove analyzing state if failed
            updatedHabits = updatedHabits.map(h => {
                if (h.id === habitId) {
                    return { ...h, isAiAnalyzing: false, emoji: '📝' }; // Default emoji
                }
                return h;
            });
            setHabits(updatedHabits);
            await saveToFirebase(updatedHabits, completions, notes);
        }
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

        // Auto-sort: Unchecked at top, Checked at bottom
        if (date === today) {
            const currentHabits = habits.filter(h => h.createdAt === today);
            const otherHabits = habits.filter(h => h.createdAt !== today);

            const sortedToday = [...currentHabits].sort((a, b) => {
                const aDone = newDayIds.includes(a.id);
                const bDone = newDayIds.includes(b.id);
                if (aDone === bDone) return 0; // Keep existing relative order
                return aDone ? 1 : -1; // Unchecked comes first
            });

            const reorderedAll = [...otherHabits, ...sortedToday];
            setHabits(reorderedAll);
            await saveToFirebase(reorderedAll, newCompletions, notes);
        } else {
            await saveToFirebase(habits, newCompletions, notes);
        }
    };

    const saveNote = async (date: string) => {
        const newNotes = { ...notes, [date]: tempNote };
        setNotes(newNotes);
        setEditingNoteDate(null);
        await saveToFirebase(habits, completions, newNotes);
    };

    const copyTaskToToday = async (text: string) => {
        const habitId = Date.now().toString();
        const habit: Habit = {
            id: habitId,
            text: text,
            createdAt: today,
            isAiAnalyzing: true
        };

        let updatedHabits = [...habits, habit];
        setHabits(updatedHabits);
        await saveToFirebase(updatedHabits, completions, notes);

        try {
            const suggestion = await suggestTaskDetails(text);
            updatedHabits = updatedHabits.map(h => {
                if (h.id === habitId) {
                    return {
                        ...h,
                        emoji: suggestion.emoji,
                        category: suggestion.category,
                        isAiAnalyzing: false
                    };
                }
                return h;
            });
            setHabits(updatedHabits);
            await saveToFirebase(updatedHabits, completions, notes);
        } catch (error) {
            console.error("AI Copy generation failed:", error);
            updatedHabits = updatedHabits.map(h => {
                if (h.id === habitId) {
                    return { ...h, isAiAnalyzing: false, emoji: '📝' };
                }
                return h;
            });
            setHabits(updatedHabits);
            await saveToFirebase(updatedHabits, completions, notes);
        }
    };

    const copyTasksToToday = async (tasksToCopy: Habit[]) => {
        if (tasksToCopy.length === 0) return;

        const newHabits = tasksToCopy.map((h, i) => ({
            id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
            text: h.text,
            createdAt: today
        }));

        const updatedHabits = [...habits, ...newHabits];
        setHabits(updatedHabits);
        await saveToFirebase(updatedHabits, completions, notes);
        setActiveTab('today');
    };

    const prepareCopyAllTasks = (date: string) => {
        const sourceHabits = habits.filter(h => h.createdAt === date);
        if (sourceHabits.length === 0) return;

        setSelectedTasksToCopy(sourceHabits.map(h => h.id)); // Default select all
        setConfirmation({
            isOpen: true,
            title: t.konfirmasi_salin,
            message: t.pesan_salin_banyak,
            details: `${sourceHabits.length} Tasks`,
            tasks: sourceHabits,
            onConfirm: (selectedIds) => {
                const tasksToCopy = sourceHabits.filter(h => selectedIds?.includes(h.id));
                copyTasksToToday(tasksToCopy);
            }
        });
    };

    const completeTutorial = async () => {
        setShowTutorial(false);
        if (user) {
            await setDoc(doc(db, 'users', user.uid), {
                tutorialSeen: true
            }, { merge: true });
        }
    };

    const getProgress = (date: string) => {
        const dateHabits = habits.filter(h => h.createdAt === date);
        if (dateHabits.length === 0) return 0;
        const doneCount = dateHabits.filter(h => (completions[date] || []).includes(h.id)).length;
        return Math.round((doneCount / dateHabits.length) * 100);
    };

    const handleReorder = (newTodayOrder: Habit[]) => {
        const otherHabits = habits.filter(h => h.createdAt !== today);
        const reorderedHabits = [...otherHabits, ...newTodayOrder];
        setHabits(reorderedHabits);
        saveToFirebase(reorderedHabits, completions, notes);
    };

    const handleEatTheFrog = async () => {
        const todayHabits = habits.filter(h => h.createdAt === today);
        const pendingHabits = todayHabits.filter(h => !(completions[today] || []).includes(h.id));

        if (pendingHabits.length === 0) return;

        setThinkingFrog(true);
        setPriorityTaskId(null);

        try {
            const priorityId = await identifyPriorityTask(pendingHabits);
            if (priorityId) {
                setPriorityTaskId(priorityId);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setThinkingFrog(false);
        }
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
                                src="/pingtidy.png"
                                alt="PingTidy Logo"
                                className="w-full h-full object-contain mix-blend-multiply dark:invert dark:mix-blend-screen opacity-90"
                            />
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter">
                            PingTidy
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
                                    text: "PingTidy changed how I view my daily progress. Simple, effectively beautiful.",
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
                                <h2 className="text-xl md:text-2xl font-['Caveat'] font-bold text-slate-500 -mb-1 transform -rotate-2">PingTidy Hub</h2>
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

                            <AnimatePresence>
                                {(loadingBriefing || morningBriefing) && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                        animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
                                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-gradient-to-tr from-[#FF9A9E] via-[#FECFEF] to-[#FECFEF] dark:from-indigo-600 dark:via-purple-600 dark:to-blue-600 text-slate-800 dark:text-white rounded-[2rem] p-6 md:p-8 shadow-2xl shadow-purple-500/20 relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                                <Zap className="w-32 h-32 rotate-12" />
                                            </div>

                                            {loadingBriefing ? (
                                                <div className="flex items-center gap-4 py-4">
                                                    <Loader2 className="w-8 h-8 animate-spin" />
                                                    <div className="space-y-2">
                                                        <div className="h-6 w-48 bg-white/20 rounded animate-pulse" />
                                                        <div className="h-4 w-64 bg-white/20 rounded animate-pulse" />
                                                    </div>
                                                </div>
                                            ) : morningBriefing && (
                                                <div className="relative z-10 space-y-6">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="font-['Caveat'] text-3xl font-bold mb-2">{morningBriefing.greeting}</h3>
                                                            <p className="text-slate-700/80 dark:text-indigo-100 font-medium text-sm md:text-base leading-relaxed opacity-90 max-w-lg">
                                                                {morningBriefing.summary}
                                                            </p>
                                                        </div>
                                                        <button onClick={() => setMorningBriefing(null)} className="bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 p-2 rounded-full transition-colors backdrop-blur-sm">
                                                            <X className="w-4 h-4 text-slate-800 dark:text-white" />
                                                        </button>
                                                    </div>

                                                    <div className="bg-white/40 dark:bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 dark:border-white/10 flex gap-4 items-center shadow-sm">
                                                        <div className="bg-white/50 dark:bg-white/20 p-2.5 rounded-xl shrink-0">
                                                            <Zap className="w-5 h-5 text-amber-500 dark:text-yellow-300 fill-amber-500 dark:fill-yellow-300" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-500 dark:text-indigo-200 uppercase tracking-wider mb-0.5">Focus Tip</p>
                                                            <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{morningBriefing.suggestion}</p>
                                                        </div>
                                                    </div>

                                                    <div className="pt-2 border-t border-slate-200/50 dark:border-white/10">
                                                        <p className="text-xs md:text-sm font-medium italic opacity-75 text-center flex items-center justify-center gap-2">
                                                            <span className="w-1 h-1 bg-white rounded-full opacity-50"></span>
                                                            {morningBriefing.motivation}
                                                            <span className="w-1 h-1 bg-white rounded-full opacity-50"></span>
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

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

                            {/* Eat The Frog Button */}
                            {habits.filter(h => h.createdAt === today && !(completions[today] || []).includes(h.id)).length > 1 && (
                                <div className="flex justify-end -mt-4 mb-2">
                                    <button
                                        onClick={handleEatTheFrog}
                                        disabled={thinkingFrog}
                                        className="relative flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all text-xs md:text-sm font-bold disabled:opacity-70 disabled:cursor-not-allowed group z-20"
                                    >
                                        {thinkingFrog ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-yellow-300 text-yellow-300" />}
                                        {thinkingFrog ? "Analyzing..." : "Eat The Frog"}

                                        <div className="absolute top-1/2 -translate-y-1/2 left-full ml-3 pointer-events-none w-max flex items-center gap-1">
                                            <svg className="w-8 h-6 text-blue-600 dark:text-blue-400 rotate-[10deg]" viewBox="0 0 50 30" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M48 15 Q 25 25, 2 15" strokeLinecap="round" />
                                                <path d="M2 15 L 10 10" strokeLinecap="round" />
                                                <path d="M2 15 L 12 20" strokeLinecap="round" />
                                            </svg>
                                            <span className="font-['Caveat'] text-xl md:text-2xl text-blue-600 dark:text-blue-400 rotate-[6deg] block drop-shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900/50">Try AI Priority! 🐸</span>
                                        </div>
                                    </button>
                                </div>
                            )}

                            <form onSubmit={addHabit} className="relative group">
                                <div className="absolute -top-10 left-10 -rotate-3 pointer-events-none hidden md:block animate-pulse">
                                    <span className="font-['Caveat'] text-2xl text-slate-400 dark:text-slate-500 rotate-2 block">✨ AI will auto-tag emojis!</span>
                                    <svg className="w-8 h-8 text-slate-400 dark:text-slate-500 absolute -bottom-2 left-1/2 translate-y-full -translate-x-1/2 rotate-180" viewBox="0 0 30 50" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M15 0 C 15 20, 20 30, 25 45" strokeLinecap="round" />
                                        <path d="M25 45 L 20 35" strokeLinecap="round" />
                                        <path d="M25 45 L 30 38" strokeLinecap="round" />
                                    </svg>
                                </div>
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
                                                    src="/pingtidy.png"
                                                    alt="No Data"
                                                    className="w-full h-full object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                                                />
                                            </div>
                                            <p className="text-slate-400 font-bold text-lg md:text-xl">{t.belum_ada_data}</p>
                                        </motion.div>
                                    ) : (
                                        <Reorder.Group axis="y" values={habits.filter(h => h.createdAt === today)} onReorder={handleReorder} className="space-y-4 md:space-y-5">
                                            {habits.filter(h => h.createdAt === today).map((habit) => {
                                                const isDone = (completions[today] || []).includes(habit.id);
                                                return (
                                                    <Reorder.Item
                                                        key={habit.id}
                                                        value={habit}
                                                        layout
                                                        whileDrag={{ scale: 1.02, zIndex: 50, cursor: "grabbing" }}
                                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                        className={cn("group flex items-center p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] transition-colors duration-200 border-2 select-none relative",
                                                            isDone ? "bg-blue-600 border-blue-600 shadow-2xl shadow-blue-500/30" :
                                                                habit.id === priorityTaskId ? "bg-white dark:bg-slate-800 border-blue-500 shadow-xl shadow-blue-500/20 scale-[1.02] ring-2 ring-blue-500/20 z-10" : "bg-white dark:bg-slate-800 border-transparent shadow-sm hover:shadow-xl dark:hover:border-slate-700")}>

                                                        {habit.id === priorityTaskId && !isDone && (
                                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full flex items-center gap-1 shadow-lg z-20 whitespace-nowrap">
                                                                <Zap className="w-3 h-3 fill-yellow-300 text-yellow-300" />
                                                                Priority Task
                                                            </div>
                                                        )}

                                                        <div className="mr-3 md:mr-4 cursor-grab active:cursor-grabbing p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400">
                                                            <GripVertical className="w-5 h-5 md:w-6 md:h-6" />
                                                        </div>
                                                        <button onClick={() => toggleHabit(habit.id)} className="mr-3 md:mr-4 focus:outline-none shrink-0">
                                                            {isDone ? <div className="bg-white rounded-2xl p-1.5"><CheckCircle2 className="text-blue-600 w-8 h-8 md:w-10 md:h-10" /></div> : <Circle className="text-slate-200 dark:text-slate-700 w-8 h-8 md:w-10 md:h-10 hover:text-blue-500 transition-colors" />}
                                                        </button>
                                                        <span className={cn("flex-1 font-extrabold text-lg md:text-2xl transition-all flex items-center gap-3", isDone ? "text-white/80 line-through" : "text-slate-800 dark:text-slate-100")}>
                                                            {habit.emoji && <span className="text-xl md:text-3xl">{habit.emoji}</span>}
                                                            <span>{habit.text}</span>
                                                            {habit.isAiAnalyzing && <RefreshCw className="w-4 h-4 animate-spin text-blue-500 opacity-50" />}
                                                        </span>
                                                        <button onClick={() => deleteHabit(habit.id)} className={cn("p-3 md:p-4 rounded-2xl transition-all", isDone ? "text-white/40 hover:text-white" : "opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500")}>
                                                            <Trash2 className="w-5 h-5 md:w-6 md:h-6" />
                                                        </button>
                                                    </Reorder.Item>
                                                );
                                            })}
                                        </Reorder.Group>
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
                                        className="bg-zinc-50 dark:bg-zinc-900/50 rounded-[1.5rem] p-4 shadow-inner border border-zinc-100 dark:border-zinc-800 overflow-hidden mb-6"
                                    >
                                        <div className="flex justify-between items-center mb-4 px-2">
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.setFullYear(calendarMonth.getFullYear() - 1)))} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-full shadow-sm transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                                                <ChevronLeft className="w-4 h-4 text-zinc-500" />
                                            </button>
                                            <h4 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                                                {calendarMonth.getFullYear()}
                                            </h4>
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.setFullYear(calendarMonth.getFullYear() + 1)))} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-full shadow-sm transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                                                <ChevronRight className="w-4 h-4 text-zinc-500" />
                                            </button>
                                        </div>
                                        <div className="relative overflow-x-auto pb-2 scrollbar-hide">
                                            <div className="min-w-max">
                                                <div className="flex pb-2">
                                                    <div className="w-6 shrink-0 flex flex-col justify-between text-[8px] font-bold text-zinc-400 dark:text-zinc-600 py-1 h-[88px]">
                                                        <span>Mon</span>
                                                        <span>Wed</span>
                                                        <span>Fri</span>
                                                    </div>
                                                    <div className="grid grid-rows-7 grid-flow-col gap-[2px]">
                                                        {(() => {
                                                            const year = calendarMonth.getFullYear();
                                                            const days = [];
                                                            const firstDayOfYear = new Date(year, 0, 1);
                                                            const startOffset = firstDayOfYear.getDay();

                                                            for (let i = 0; i < startOffset; i++) {
                                                                days.push(<div key={`empty-start-${i}`} className="w-2.5 h-2.5" />);
                                                            }

                                                            const date = new Date(year, 0, 1);
                                                            while (date.getFullYear() === year) {
                                                                const dateStr = formatDateKey(date);
                                                                const progress = getProgress(dateStr);
                                                                const isToday = dateStr === today;
                                                                const isSelected = selectedDate === dateStr;
                                                                const hasData = habits.some(h => h.createdAt === dateStr);
                                                                const keyDate = date.getTime();

                                                                let bgClass = "bg-zinc-200 dark:bg-zinc-800/50";

                                                                if (hasData) {
                                                                    if (progress === 100) bgClass = "bg-[#216e39]";
                                                                    else if (progress >= 75) bgClass = "bg-[#30a14e]";
                                                                    else if (progress >= 50) bgClass = "bg-[#40c463]";
                                                                    else if (progress > 0) bgClass = "bg-[#9be9a8]";
                                                                    else bgClass = "bg-zinc-300 dark:bg-zinc-700";
                                                                }

                                                                if (isSelected) bgClass += " ring-1 ring-black dark:ring-white z-10 scale-125";
                                                                if (isToday) bgClass += " ring-1 ring-offset-1 ring-blue-500 z-10";

                                                                days.push(
                                                                    <button
                                                                        key={keyDate}
                                                                        onClick={() => {
                                                                            setSelectedDate(isSelected ? null : dateStr);
                                                                            setExpandedDate(dateStr);
                                                                        }}
                                                                        className={cn(
                                                                            "w-2.5 h-2.5 rounded-sm transition-all hover:scale-125 hover:z-20",
                                                                            bgClass
                                                                        )}
                                                                        title={`${dateStr}: ${progress}%`}
                                                                    />
                                                                );

                                                                date.setDate(date.getDate() + 1);
                                                            }
                                                            return days;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
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
                                                "group rounded-[2.5rem] transition-all overflow-hidden",
                                                isToday ? "bg-white dark:bg-slate-800 shadow-xl border border-blue-100 dark:border-blue-900/30" : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800",
                                                isExpanded && "ring-0"
                                            )}
                                        >
                                            <button
                                                onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                                                className="w-full text-left p-6 flex items-center justify-between gap-4 focus:outline-none"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-14 h-14 rounded-2xl flex flex-col items-center justify-center border-2",
                                                        isToday ? "bg-blue-600 border-blue-600 text-white" : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                                                    )}>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">{d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'short' })}</span>
                                                        <span className="text-xl font-black leading-none">{d.getDate()}</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">
                                                            {isToday ? t.hari_ini : d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'long' })}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="flex-1 h-1.5 w-32 md:w-48 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                <div className={cn("h-full rounded-full", progress === 100 ? "bg-green-500" : "bg-blue-500")} style={{ width: `${progress}%` }} />
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-400">{progress}%</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {!isToday && habits.filter(h => h.createdAt === dateKey).length > 0 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                prepareCopyAllTasks(dateKey);
                                                            }}
                                                            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95"
                                                            title="Salin semua ke Hari Ini"
                                                        >
                                                            <Copy className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
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
                                                                                {habit.emoji && <span className="mr-2">{habit.emoji}</span>}
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
                            {confirmation.tasks ? (
                                <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.pilih_semua}</span>
                                        <button
                                            onClick={() => {
                                                if (selectedTasksToCopy.length === confirmation.tasks?.length) {
                                                    setSelectedTasksToCopy([]);
                                                } else {
                                                    setSelectedTasksToCopy(confirmation.tasks?.map(h => h.id) || []);
                                                }
                                            }}
                                            className="text-blue-600 font-bold text-xs"
                                        >
                                            {selectedTasksToCopy.length === confirmation.tasks?.length ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {confirmation.tasks.map(task => (
                                        <div key={task.id}
                                            onClick={() => {
                                                if (selectedTasksToCopy.includes(task.id)) {
                                                    setSelectedTasksToCopy(selectedTasksToCopy.filter(id => id !== task.id));
                                                } else {
                                                    setSelectedTasksToCopy([...selectedTasksToCopy, task.id]);
                                                }
                                            }}
                                            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                                        >
                                            <div className={cn("shrink-0 transition-colors", selectedTasksToCopy.includes(task.id) ? "text-blue-600" : "text-slate-300")}>
                                                {selectedTasksToCopy.includes(task.id) ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-current" />}
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{task.text}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : confirmation.details && (
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
                                    onClick={() => { confirmation.onConfirm(selectedTasksToCopy); setConfirmation(null); }}
                                    className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all"
                                >
                                    {t.ya}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showTutorial && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
                        >
                            {/* Background decoration */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-1">
                                        {[0, 1, 2, 3, 4].map(i => (
                                            <div key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i === tutorialStep ? "w-8 bg-blue-600" : i < tutorialStep ? "w-2 bg-blue-200" : "w-2 bg-slate-100 dark:bg-slate-700")} />
                                        ))}
                                    </div>
                                    <button onClick={completeTutorial} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-wider">
                                        Skip
                                    </button>
                                </div>

                                <div className="min-h-[280px] flex flex-col">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={tutorialStep}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="flex-1 flex flex-col items-center text-center"
                                        >
                                            <div className="w-24 h-24 bg-blue-50 dark:bg-slate-700/50 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/10">
                                                {tutorialStep === 0 && <img src="/pingtidy.png" alt="Welcome" className="w-16 h-16 object-contain" />}
                                                {tutorialStep === 1 && <Plus className="w-10 h-10 text-blue-600" />}
                                                {tutorialStep === 2 && <CheckCircle2 className="w-10 h-10 text-green-500" />}
                                                {tutorialStep === 3 && <Edit3 className="w-10 h-10 text-orange-500" />}
                                                {tutorialStep === 4 && <History className="w-10 h-10 text-purple-500" />}
                                            </div>

                                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
                                                {tutorialStep === 0 && "Welcome to PingTidy Hub!"}
                                                {tutorialStep === 1 && "Start Small"}
                                                {tutorialStep === 2 && "Track Progress"}
                                                {tutorialStep === 3 && "Daily Reflection"}
                                                {tutorialStep === 4 && "History & Copy"}
                                            </h3>

                                            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                                {tutorialStep === 0 && "Your journey to consistency starts here. Let's take a quick tour to get you started."}
                                                {tutorialStep === 1 && "Type your target or habit for today in the input field and tap the (+) button."}
                                                {tutorialStep === 2 && "Tap the circle on any task to mark it done. Watch your daily progress ring grow!"}
                                                {tutorialStep === 3 && "Add notes to evaluate your day. Tap the 'Edit Note' button in the detailed view."}
                                                {tutorialStep === 4 && "View past days in the History tab. You can easily copy tasks from past days to today."}
                                            </p>
                                        </motion.div>
                                    </AnimatePresence>

                                    <div className="mt-8">
                                        <button
                                            onClick={() => {
                                                if (tutorialStep < 4) {
                                                    setTutorialStep(tutorialStep + 1);
                                                } else {
                                                    completeTutorial();
                                                }
                                            }}
                                            className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                                        >
                                            {tutorialStep === 4 ? "Get Started" : "Next Step"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
