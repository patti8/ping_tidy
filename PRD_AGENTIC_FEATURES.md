# Product Requirements Document: Fitur Agentic AI untuk Habit Tracker

**Tanggal:** 21 Januari 2026  
**Status:** Draft  
**Target User:** Pengguna Indonesia (Jakarta), Profesional & Personal  
**Tech Stack:** Gemini 1.5 Flash (Free Tier) via Google AI Studio API

## 1. Executive Summary
Dokumen ini berisi usulan 8 fitur berbasis AI ("Agentic") untuk meningkatkan retensi dan *completion rate* pengguna. Fokus utama adalah fitur yang memberikan nilai tambah personal, membuat aplikasi terasa "hidup" dan "mengerti" user, dengan implementasi yang efisien tanpa backend kompleks.

## 2. Daftar Fitur (Prioritas & Kesulitan)

Berikut adalah 8 ide fitur, diurutkan dari kemudahan implementasi (Low Effort) hingga yang lebih kompleks (High Value).

### 2.1. Smart Emoji & Labeling (Pelabelan Otomatis)
* **Deskripsi:** Saat user mengetik nama tugas baru (misal: "Meeting budget Q1"), AI otomatis menyarankan emoji yang relevan (💼) dan kategori (Work) tanpa user perlu memilih manual.
* **Manfaat User:** Membuat list terlihat rapi dan visual secara instan. Menghemat waktu tap-tap kategori.
* **Peran AI:** Klasifikasi teks singkat (Zero-shot classification) ke dalam daftar emoji/kategori.
* **Kesulitan:** **Mudah** (1 prompt sederhana).

### 2.2. "Eat The Frog" Detector (Deteksi Prioritas)
* **Deskripsi:** Dari sekian banyak checklist harian, AI menandai satu tugas yang dianggap paling "berat" atau penting untuk diselesaikan pertama kali di pagi hari.
* **Manfaat User:** Membantu user mengatasi *decision paralysis* (bingung mau mulai dari mana).
* **Peran AI:** Analisis konteks tugas berdasarkan kata kunci (misal: "Laporan", "Deadline", "Urgent") untuk menentukan bobot urgensi.
* **Kesulitan:** **Mudah**

### 2.3. Morning Briefing & Motivation (Sapaan Pagi Personal)
* **Deskripsi:** Saat user membuka aplikasi pertama kali di pagi hari, muncul *card* kecil berisi sapaan semangat yang kontekstual. Contoh: "Selamat pagi! Hari ini ada 5 tugas, fokus ke 'Presentasi' dulu ya. Semangat!"
* **Manfaat User:** Menciptakan koneksi emosional ("App ini peduli sama gue") dan memberikan *overview* cepat.
* **Peran AI:** Generate teks pendek (1 paragraf) berdasarkan data JSON tugas hari ini + Nama User.
* **Kesulitan:** **Sedang** (Perlu trigger state "first open").

### 2.4. Smart Task Breakdown (Pemecah Tugas)
* **Deskripsi:** User bisa menekan tombol "Magic Wand" pada tugas yang terdengar besar/abstrak (contoh: "Pindahan Rumah"). AI akan memecahnya menjadi 3-5 sub-tugas kecil yang actionable (Packing baju, Sewa truk, dll).
* **Manfaat User:** Mengurangi prokrastinasi karena tugas besar terasa lebih ringan dan terarah.
* **Peran AI:** Generative breaking down: Input 1 string -> Output Array of strings.
* **Kesulitan:** **Sedang** (Integrasi UI untuk insert items).

### 2.5. The "Stale Task" Doctor (Dokter Tugas Basi)
* **Deskripsi:** Jika ada tugas yang sudah 3 hari berturut-turut tidak dicentang (di-carry over), AI muncul proaktif: "Tugas 'Bayar Pajak' udah 3 hari dicuekin ni. Mau dijadwalin ulang ke Weekend atau dipecah jadi kecil aja?"
* **Manfaat User:** Membersihkan *clutter* dan mengurangi rasa bersalah (*guilt*) user melihat tugas menumpuk.
* **Peran AI:** Analisis pola penundaan dan memberikan saran empati + opsi solusi.
* **Kesulitan:** **Sedang** (Logic checking history task).

### 2.6. Weekly Review Insights (Analis Mingguan)
* **Deskripsi:** Setiap hari Senin/Minggu, user mendapat ringkasan: "Minggu ini produktivitasmu 70%. Kamu hebat di 'Olahraga' tapi sering skip 'Baca Buku' di hari Kamis."
* **Manfaat User:** Memberikan *feedback loop* agar user sadar pola perilaku mereka (Self-awareness).
* **Peran AI:** Analisis data agregat seminggu -> Narasi Insightful (bukan sekedar angka).
* **Kesulitan:** **Sedang - Agak Sulit** (Perlu mengirim konteks data history yang lebih banyak ke context window).

### 2.7. Natural Language Quick Add (Input Bahasa Manusia)
* **Deskripsi:** User mengetik/voice: "Ingetin beli obat besok jam 7 malam". App otomatis membuat task "Beli obat", set tanggal besok, set jam 19:00.
* **Manfaat User:** Kecepatan input yang luar biasa, *frictionless*.
* **Peran AI:** Entity extraction (Parsing teks jadi JSON: {task, date, time, tags}).
* **Kesulitan:** **Agak Sulit** (Parsing waktu relatif seperti "besok", "lusa", "minggu depan" perlu validasi).

### 2.8. Negotiable Habit Goals (Negosiasi Target)
* **Deskripsi:** Saat user hendak membatalkan habit karena sibuk, AI menawarkan "mini-habit". User: "Lagi males lari 5km." AI: "Oke gapapa, gimana kalau jalan santai 10 menit aja? Yang penting streak terjaga."
* **Manfaat User:** Menjaga konsistensi (*Something is better than nothing*). Mencegah streak putus total.
* **Peran AI:** Menawarkan alternatif aktivitas yang lebih ringan berdasarkan aktivitas utama.
* **Kesulitan:** **Agak Sulit** (Interaksi conversation/UI flow lebih dinamis).

## 3. Catatan Teknis (Gemini 1.5 Flash)
* **Model:** `gemini-1.5-flash`
* **Keunggulan:** Latency sangat rendah (cocok untuk UI interaktif), Token window besar (bisa masukin history user 1 bulan), dan Gratis (Rate limit cukup untuk userbase awal).
* **Format Output:** Selalu minta AI output dalam format **JSON** agar mudah diolah frontend (`JSON Mode`).
* **Prompt Schema:**
    ```json
    {
      "role": "productivity_coach",
      "tone": "friendly_indonesian_jakarta_slang",
      "task_context": "..."
    }
    ```

## 4. Next Steps
1. Setup API Key Gemini di `.env`.
2. Buat file utility `src/lib/gemini.ts` untuk handle call ke API.
3. Mulai implementasi dari fitur termudah: **2.1 Smart Emoji**.
