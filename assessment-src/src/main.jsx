import React, { useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const PROFILE_ORDER = ["creative", "communicator", "integrator", "explorer"];

const PROFILES = {
  creative: {
    name: "Creative Thinker",
    icon: "✦",
    color: "#F6A821",
    description: "Kamu senang melihat banyak kemungkinan dan mengembangkan ide dengan caramu sendiri.",
    grow: "Coba buat lebih dari satu kemungkinan sebelum memilih ide favoritmu."
  },
  communicator: {
    name: "Confident Communicator",
    icon: "◉",
    color: "#2563EB",
    description: "Kamu punya keberanian untuk menyusun ide dan membuat orang lain ikut merasakan semangatmu.",
    grow: "Latih ceritamu dengan urutan masalah, solusi, lalu manfaatnya."
  },
  integrator: {
    name: "Smart AI Integrator",
    icon: "⌁",
    color: "#1BA84A",
    description: "Kamu mulai memahami bahwa AI membantu proses berpikir, bukan menggantikan seluruh usahamu.",
    grow: "Ingat untuk memeriksa hasil AI dan selalu menjaga informasi pribadimu."
  },
  explorer: {
    name: "Curious Explorer",
    icon: "⌕",
    color: "#7C5CE6",
    description: "Rasa ingin tahumu membantu menemukan masalah dan memahami apa yang benar-benar dibutuhkan orang lain.",
    grow: "Sebelum membuat solusi, coba tanyakan ‘mengapa’ dan ‘untuk siapa’ lebih dulu."
  }
};

const QUESTIONS = [
  {
    dimension: "explorer",
    text: "Kamu melihat antrean di kantin sekolah sering sangat panjang. Apa yang kemungkinan besar kamu lakukan?",
    options: [
      ["Mengamati dan bertanya kepada beberapa anak mengapa antreannya lama", 3],
      ["Tidak terlalu memikirkannya", 0],
      ["Mencari makanan diluar sekolah", 1],
      ["Mengamati kapan antrean paling ramai", 2]
    ]
  },
  {
    dimension: "explorer",
    text: "Kamu diminta mencari masalah yang bisa diperbaiki di sekolah. Bagaimana kamu memulainya?",
    options: [
      ["Berjalan berkeliling dan memperhatikan keadaan sekitar", 2],
      ["Menunggu orang lain memberikan ide", 0],
      ["Mengamati, bertanya, dan mencari tahu siapa yang paling terganggu", 3],
      ["Memilih masalah pertama yang terpikir", 1]
    ]
  },
  {
    dimension: "explorer",
    text: "Seseorang mengatakan solusi buatanmu belum membantu mereka. Apa yang kamu lakukan?",
    options: [
      ["Bertanya bagian mana yang belum membantu dan mengapa", 3],
      ["Langsung mengganti seluruh ide", 1],
      ["Mengabaikannya karena menurutku idenya sudah bagus", 0],
      ["Bertanya kepada teman lain apakah mereka setuju", 2]
    ]
  },
  {
    dimension: "creative",
    text: "Ide pertamamu tidak bekerja seperti yang kamu harapkan. Apa yang paling mungkin kamu lakukan?",
    options: [
      ["Menyederhanakan idenya agar lebih mudah dilakukan", 2],
      ["Mencoba beberapa pendekatan lalu menggabungkan bagian terbaiknya", 3],
      ["Berhenti dan memilih aktivitas lain", 0],
      ["Mencoba cara yang sama sekali lagi", 1]
    ]
  },
  {
    dimension: "creative",
    text: "Kamu diminta membuat botol minum menjadi lebih menarik atau berguna. Bagaimana kamu mencari ide?",
    options: [
      ["Menggunakan ide pertama yang muncul", 1],
      ["Membuat beberapa ide, lalu menggabungkan fitur yang paling menarik", 3],
      ["Meniru botol yang sudah populer", 0],
      ["Bertanya kepada teman apa yang mereka butuhkan", 2]
    ]
  },
  {
    dimension: "creative",
    text: "Kamu harus membuat sesuatu, tetapi bahan yang tersedia terbatas. Apa responsmu?",
    options: [
      ["Menggunakan bahan yang tersedia dengan cara yang berbeda", 3],
      ["Menunggu sampai mendapatkan semua bahan yang diinginkan", 0],
      ["Mengubah idenya menjadi sesuatu yang lebih sederhana", 2],
      ["Tetap mengikuti rencana awal walau sulit dilakukan", 1]
    ]
  },
  {
    dimension: "integrator",
    text: "AI memberikan informasi yang terdengar sangat meyakinkan. Apa yang kamu lakukan?",
    options: [
      ["Membandingkannya dengan sumber lain atau bertanya kepada orang dewasa", 3],
      ["Menggunakannya jika jawabannya terlihat lengkap", 1],
      ["Membaca ulang dan memikirkan apakah jawabannya masuk akal", 2],
      ["Langsung menggunakannya", 0]
    ]
  },
  {
    dimension: "integrator",
    text: "AI meminta nama sekolah, alamat rumah, atau informasi pribadi lainnya. Apa yang kamu lakukan?",
    options: [
      ["Memberikan sebagian kecil saja", 1],
      ["Tidak memberikannya dan bertanya kepada orang dewasa", 3],
      ["Memberikan informasinya agar mendapat jawaban yang lebih baik", 0],
      ["Mengganti informasi tersebut dengan contoh yang tidak nyata", 2]
    ]
  },
  {
    dimension: "integrator",
    text: "AI membuatkan logo untuk idemu. Apa yang kamu lakukan selanjutnya?",
    options: [
      ["Memilih hasil yang kusukai lalu mengubah beberapa bagian", 2],
      ["Langsung menggunakan hasil pertama", 0],
      ["Menentukan tujuan logonya, membandingkan hasil, lalu memperbaikinya", 3],
      ["Meminta AI memilih logo terbaik untukku", 1]
    ]
  },
  {
    dimension: "communicator",
    text: "Kamu harus menjelaskan ide di depan kelas. Bagaimana kamu bersiap?",
    options: [
      ["Menyusun masalah, solusi, dan manfaatnya lalu berlatih", 3],
      ["Langsung berbicara tanpa persiapan", 1],
      ["Meminta teman menjelaskannya untukku", 0],
      ["Menulis seluruh isi lalu membacanya", 2]
    ]
  },
  {
    dimension: "communicator",
    text: "Kamu merasa gugup sebelum presentasi. Apa yang biasanya kamu lakukan?",
    options: [
      ["Menghafalkan setiap kata", 2],
      ["Mencoba menghindari presentasi", 0],
      ["Mengatur napas, menggunakan catatan singkat, dan tetap mencoba", 3],
      ["Berbicara secepat mungkin agar segera selesai", 1]
    ]
  },
  {
    dimension: "communicator",
    text: "Seseorang memberikan saran untuk presentasimu. Apa yang kamu lakukan?",
    options: [
      ["Mendengarkan lalu memilih saran yang kusukai", 2],
      ["Mengabaikannya", 0],
      ["Bertanya lebih jelas lalu memilih saran yang benar-benar memperbaiki presentasi", 3],
      ["Mengikuti semua sarannya", 1]
    ]
  }
];

const CREATIVE_CHALLENGES = [
  {
    id: "forgotten-items",
    title: "Barang sering tertinggal",
    problem: "Banyak anak lupa membawa alat tulis, botol minum, atau perlengkapan belajar dan baru menyadarinya saat pelajaran dimulai.",
    prompt: "Solusi apa yang ingin kamu buat agar anak-anak lebih mudah mengingat atau mendapatkan barang yang mereka perlukan?",
    placeholder: "Ceritakan produk atau layanan yang ingin kamu buat...",
    icon: "🎒",
    accent: "#2563EB"
  },
  {
    id: "waiting-pickup",
    title: "Menunggu jemputan",
    problem: "Beberapa anak harus menunggu cukup lama setelah sekolah. Mereka merasa bosan dan area tunggu menjadi ramai serta kurang teratur.",
    prompt: "Solusi apa yang ingin kamu buat agar waktu menunggu menjadi lebih menyenangkan dan teratur?",
    placeholder: "Ceritakan produk atau layanan yang ingin kamu buat...",
    icon: "⏱",
    accent: "#F6A821"
  },
  {
    id: "food-waste",
    title: "Makanan terbuang",
    problem: "Saat jam makan selesai, masih banyak makanan atau minuman yang tidak dihabiskan dan akhirnya dibuang.",
    prompt: "Solusi apa yang ingin kamu buat untuk membantu mengurangi makanan yang terbuang?",
    placeholder: "Ceritakan produk atau layanan yang ingin kamu buat...",
    icon: "🍱",
    accent: "#1BA84A"
  }
];

const STEPS_TOTAL = 16;

function Logo() {
  return <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="KidsPreneur" />;
}

function Shell({ children, step, compact = false }) {
  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="topbar-brand">
          <a href="../" aria-label="KidsPreneur.com"><Logo /></a>
        </div>
        {step > 0 && (
          <div className="progress-meta" aria-label={`Langkah ${Math.min(step, STEPS_TOTAL)} dari ${STEPS_TOTAL}`}>
            <span>YOUR PROGRESS</span>
            <strong>{Math.round((Math.min(step, STEPS_TOTAL) / STEPS_TOTAL) * 100)}%</strong>
          </div>
        )}
      </header>
      {step > 0 && (
        <div className="progress-track" aria-hidden="true">
          <div style={{ width: `${Math.min(100, (step / STEPS_TOTAL) * 100)}%` }} />
        </div>
      )}
      <section className={compact ? "content compact" : "content"}>{children}</section>
      <footer>Young Minds. Co-Existing with AI</footer>
    </main>
  );
}

function Welcome({ onStart }) {
  return (
    <Shell step={0}>
      <div className="hero-grid">
        <div>
          <span className="eyebrow">KIDSPRENEUR · STRENGTH ASSESSMENT</span>
          <h1>Temukan kekuatan<br /><em>Young Preneur</em><br />dalam dirimu.</h1>
          <p className="hero-copy">Jawab beberapa situasi, pilih satu creative challenge, dan temukan cara unikmu mengembangkan sebuah ide.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onStart}>Mulai assessment <span>→</span></button>
            <span className="duration">◷ Sekitar 10 menit</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="profile-chip chip-one"><b>✦</b><span>Creative<br />Thinker</span></div>
          <div className="profile-chip chip-two"><b>⌁</b><span>Smart AI<br />Integrator</span></div>
          <div className="profile-chip chip-three"><b>⌕</b><span>Curious<br />Explorer</span></div>
          <div className="profile-chip chip-four"><b>◉</b><span>Confident<br />Communicator</span></div>
          <div className="core-sphere"><span>YOUR</span><strong>STRENGTH</strong><small>starts here</small></div>
        </div>
      </div>
      <div className="trust-strip"><span>✓ Tidak ada jawaban sempurna</span><span>✓ Kerjakan sendiri</span><span>✓ Hasil bukan nilai ujian</span></div>
    </Shell>
  );
}

function Identity({ form, setForm, onNext }) {
  const valid = form.parentName.trim().length > 1 && form.whatsapp.trim().length > 5 && form.consent;
  return (
    <Shell step={1} compact>
      <div className="section-heading">
        <span className="eyebrow">LET'S GET STARTED</span>
        <h2>Kenalan dulu, yuk!</h2>
        <p>Ceritakan sedikit tentang dirimu sebelum memulai.</p>
      </div>
      <div className="form-panel">
        <div className="two-columns">
          <label>Nama Orang Tua *<input value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} placeholder="Nama lengkap" autoComplete="off" /></label>
          <label>Nomor WhatsApp *<input type="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="08xxxxxxxxxx" autoComplete="off" /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" autoComplete="off" /></label>
          <label>Usia Anak<input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="mis. 10 tahun" autoComplete="off" /></label>
        </div>
        <label style={{ marginTop: 18 }}>Minat Anak<input value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })} placeholder="mis. menggambar, sains, game" autoComplete="off" /></label>
        <label style={{ marginTop: 18 }}>Pernah menggunakan AI?<select value={form.aiExperience} onChange={(e) => setForm({ ...form, aiExperience: e.target.value })}><option>Belum ada</option><option>Sedikit</option><option>Cukup</option></select></label>
        <label style={{ marginTop: 18 }}>Ekspektasi setelah mengikuti kelas<textarea rows={3} value={form.expectations} onChange={(e) => setForm({ ...form, expectations: e.target.value })} placeholder="Ceritakan singkat kebutuhan Anda" /></label>
        <label className="consent"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /><span>Saya menyetujui data saya digunakan untuk menghubungi saya terkait program KidsPreneur.</span></label>
        <button className="primary-button full" disabled={!valid} onClick={onNext}>Lanjutkan <span>→</span></button>
      </div>
    </Shell>
  );
}

function Context({ context, setContext, onNext, onBack }) {
  const toggle = (key, value) => {
    const values = context[key];
    setContext({ ...context, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] });
  };
  const valid = context.childName.trim().length > 1 && context.frequency && context.tools.trim().length > 0 && context.experiences.length;
  return (
    <Shell step={2}>
      <div className="section-heading left">
        <span className="eyebrow">A LITTLE ABOUT YOU</span>
        <h2>Pengalamanmu sejauh ini</h2>
        <p>Bagian ini tidak memengaruhi hasil. Kami hanya ingin mengenal pengalamanmu.</p>
      </div>
      <div className="notice"><span>◎</span><p><strong>Mulai dari sini, giliran kamu yang mengisi, ya!</strong><br />Kerjakan dengan jawabanmu sendiri. Jangan meminta bantuan AI atau orang tua saat menjawab pertanyaan-pertanyaan berikutnya.</p></div>
      <div className="context-stack">
        <label>Nama Anak *<input value={context.childName} onChange={(e) => setContext({ ...context, childName: e.target.value })} placeholder="Nama panggilan anak" autoComplete="off" /></label>
        <fieldset><legend>Seberapa sering kamu pernah menggunakan alat AI?</legend><div className="option-grid compact-options">{["Belum pernah", "Pernah 1–2 kali", "Kadang-kadang", "Cukup sering"].map((item) => <button key={item} className={context.frequency === item ? "choice selected" : "choice"} onClick={() => setContext({ ...context, frequency: item })}>{item}</button>)}</div></fieldset>
        <fieldset><legend>AI apa yang pernah kamu gunakan? <small>Boleh sebutkan lebih dari satu</small></legend><input value={context.tools} onChange={(e) => setContext({ ...context, tools: e.target.value })} placeholder="mis. ChatGPT, Gemini" autoComplete="off" /></fieldset>
        <fieldset><legend>Mana yang pernah kamu lakukan? <small>Boleh pilih lebih dari satu</small></legend><div className="tag-options">{["Membuat presentasi", "Membuat poster / logo", "Menjelaskan ide", "Proyek kelompok", "Belum pernah"].map((item) => <button key={item} className={context.experiences.includes(item) ? "tag selected" : "tag"} onClick={() => toggle("experiences", item)}>{context.experiences.includes(item) ? "✓ " : "+ "}{item}</button>)}</div></fieldset>
      </div>
      <NavButtons onBack={onBack} onNext={onNext} disabled={!valid} />
    </Shell>
  );
}

function Question({ index, answer, onAnswer, onNext, onBack }) {
  const question = QUESTIONS[index];
  return (
    <Shell step={index + 3} compact>
      <article className="question-card">
        <h2>{question.text}</h2>
        <p className="helper">Pilih jawaban yang paling mirip dengan apa yang biasanya kamu lakukan.</p>
        <div className="answer-list">
          {question.options.map(([text], optionIndex) => (
            <button key={text} className={answer === optionIndex ? "answer selected" : "answer"} onClick={() => onAnswer(optionIndex)}>
              <span className="answer-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{text}</span><i>{answer === optionIndex ? "✓" : ""}</i>
            </button>
          ))}
        </div>
      </article>
      <NavButtons onBack={onBack} onNext={onNext} disabled={answer === undefined} nextLabel={index === QUESTIONS.length - 1 ? "Creative challenge" : "Pertanyaan berikutnya"} />
    </Shell>
  );
}

function ChallengeSelection({ selected, onSelect, onNext, onBack }) {
  return (
    <Shell step={15}>
      <div className="section-heading left challenge-heading">
        <span className="eyebrow">CREATIVE CHALLENGE</span>
        <h2>Pilih satu masalah</h2>
        <p>Pilih situasi yang paling menarik bagimu. Kamu hanya perlu mengerjakan satu challenge.</p>
      </div>
      <div className="challenge-options">
        {CREATIVE_CHALLENGES.map((challenge) => (
          <button key={challenge.id} className={selected === challenge.id ? "challenge-option selected" : "challenge-option"} style={{ "--challenge-accent": challenge.accent }} onClick={() => onSelect(challenge.id)}>
            <span className="challenge-option-icon" aria-hidden="true">{challenge.icon}</span>
            <strong>{challenge.title}</strong>
            <p>{challenge.problem}</p>
            <i>{selected === challenge.id ? "✓ Dipilih" : "Pilih challenge"}</i>
          </button>
        ))}
      </div>
      <NavButtons onBack={onBack} onNext={onNext} disabled={!selected} nextLabel="Buat solusiku" />
    </Shell>
  );
}

function Challenge({ selected, response, setResponse, onNext, onBack, submitting }) {
  const challenge = CREATIVE_CHALLENGES.find((item) => item.id === selected);
  const valid = response.trim().length >= 12;
  return (
    <Shell step={16} compact>
      <div className="section-heading left challenge-heading">
        <span className="eyebrow">CREATIVE CHALLENGE</span>
        <h2>{challenge.title}</h2>
        <p>Kami sudah menyiapkan masalahnya. Sekarang giliranmu memikirkan solusi.</p>
      </div>
      <article className="challenge-page-card" style={{ "--challenge-accent": challenge.accent }}>
        <div className="challenge-illustration" aria-hidden="true">{challenge.icon}</div>
        <div className="problem-brief">
          <span>MASALAH YANG TERJADI</span>
          <p>{challenge.problem}</p>
        </div>
        <label className="solution-field">
          {challenge.prompt}
          <textarea maxLength={350} value={response} onChange={(e) => setResponse(e.target.value)} placeholder={challenge.placeholder} />
          <small>{response.length}/350</small>
        </label>
      </article>
      <NavButtons onBack={onBack} onNext={onNext} disabled={!valid || submitting} nextLabel={submitting ? "Menyiapkan hasil..." : "Lihat hasilku"} />
    </Shell>
  );
}

function NavButtons({ onBack, onNext, disabled, nextLabel = "Lanjutkan" }) {
  return <div className="nav-buttons"><button className="back-button" onClick={onBack}>← Kembali</button><button className="primary-button" disabled={disabled} onClick={onNext}>{nextLabel} <span>→</span></button></div>;
}

function Result({ result, savedToServer, onRestart }) {
  const core = PROFILES[result.ranking[0]];
  const support = PROFILES[result.ranking[1]];
  const growth = PROFILES[result.ranking[result.ranking.length - 1]];
  return (
    <Shell step={STEPS_TOTAL}>
      <div className="result-hero">
        <span className="eyebrow">MISSION COMPLETE</span>
        <p>Great job!</p>
        <h1>Kekuatan Young Preneur-mu<br />mulai terlihat.</h1>
      </div>
      {savedToServer === false && (
        <span className="save-notice">Hasil belum tersimpan ke server, tersimpan di perangkatmu.</span>
      )}
      <div className="strength-pair">
        <article className="strength-card core" style={{ "--profile-color": core.color }}><span>YOUR CORE STRENGTH</span><div className="strength-icon">{core.icon}</div><h2>{core.name}</h2><p>{core.description}</p></article>
        <article className="strength-card support" style={{ "--profile-color": support.color }}><span>SUPPORTING STRENGTH</span><div className="strength-icon">{support.icon}</div><h2>{support.name}</h2><p>{support.description}</p></article>
      </div>
      <section className="profile-summary">
        <div><span className="eyebrow">YOUR STRENGTH MAP</span><h2>Setiap kekuatan dapat terus tumbuh.</h2></div>
        <div className="bars">
          {PROFILE_ORDER.map((key) => <div className="bar-row" key={key}><div><span>{PROFILES[key].icon} {PROFILES[key].name}</span><small>{levelLabel(result.scores[key])}</small></div><div className="bar-track"><i style={{ width: `${18 + (result.scores[key] / 9) * 82}%`, background: PROFILES[key].color }} /></div></div>)}
        </div>
      </section>
      <section className="growth-card"><div className="growth-icon">↗</div><div><span>NEXT SKILL TO GROW</span><h3>{growth.name}</h3><p>{growth.grow}</p></div></section>
      <section className="closing-card"><span>IDEA TO REMEMBER</span><blockquote>“Tidak ada ide yang harus langsung sempurna. Ide hebat tumbuh ketika kamu berani mencoba, bertanya, dan memperbaikinya.”</blockquote><p>Sampai bertemu di kelas KidsPreneur!</p></section>
      <div className="result-cta">
        <a className="primary-button" href="../#programs">Lihat Program KidsPreneur <span>→</span></a>
        <a className="back-button" href="../#contact">Hubungi Kami</a>
      </div>
      <div className="result-footer"><span>Hasil ini bukan nilai ujian.</span><button className="text-button" onClick={onRestart}>Kembali ke awal</button></div>
    </Shell>
  );
}

function levelLabel(score) {
  if (score >= 7) return "Terlihat kuat";
  if (score >= 4) return "Sedang tumbuh";
  return "Siap dikembangkan";
}

function App() {
  const [screen, setScreen] = useState("welcome");
  const [form, setForm] = useState({ parentName: "", whatsapp: "", email: "", age: "", interests: "", aiExperience: "Belum ada", expectations: "", consent: false });
  const [context, setContext] = useState({ childName: "", frequency: "", tools: "", experiences: [] });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedChallenge, setSelectedChallenge] = useState("");
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedToServer, setSavedToServer] = useState(true);

  const scores = useMemo(() => {
    const values = { creative: 0, communicator: 0, integrator: 0, explorer: 0 };
    QUESTIONS.forEach((question, index) => {
      if (answers[index] !== undefined) values[question.dimension] += question.options[answers[index]][1];
    });
    return values;
  }, [answers]);

  const goBackFromQuestion = () => {
    if (questionIndex === 0) setScreen("context");
    else setQuestionIndex((value) => value - 1);
  };

  const restart = () => {
    setForm({ parentName: "", whatsapp: "", email: "", age: "", interests: "", aiExperience: "Belum ada", expectations: "", consent: false });
    setContext({ childName: "", frequency: "", tools: "", experiences: [] });
    setQuestionIndex(0);
    setAnswers({});
    setSelectedChallenge("");
    setChallengeAnswer("");
    setResult(null);
    setSubmitting(false);
    setSavedToServer(true);
    setScreen("welcome");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setSubmitting(true);
    const ranking = [...PROFILE_ORDER].sort((a, b) => scores[b] - scores[a] || PROFILE_ORDER.indexOf(a) - PROFILE_ORDER.indexOf(b));
    const chosenChallenge = CREATIVE_CHALLENGES.find((item) => item.id === selectedChallenge);
    const submissionId = `KP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const payload = {
      submittedAt: new Date().toISOString(),
      participantCode: submissionId,
      parentName: form.parentName,
      whatsapp: form.whatsapp,
      email: form.email,
      age: form.age,
      interests: form.interests,
      aiExperience: form.aiExperience,
      expectations: form.expectations,
      childName: context.childName,
      aiFrequency: context.frequency,
      aiTools: context.tools,
      experiences: context.experiences,
      answers: QUESTIONS.map((question, index) => ({ question: question.text, answer: question.options[answers[index]][0], dimension: question.dimension, score: question.options[answers[index]][1] })),
      scores,
      coreStrength: PROFILES[ranking[0]].name,
      supportingStrength: PROFILES[ranking[1]].name,
      nextSkill: PROFILES[ranking[ranking.length - 1]].name,
      scenario: chosenChallenge.title,
      challengeProblem: chosenChallenge.problem,
      challengeSolution: challengeAnswer,
      challengeDifference: ""
    };
    try {
      const { error } = await supabase.from("submissions").insert({
        participant_code: payload.participantCode,
        submitted_at: payload.submittedAt,
        nickname: payload.parentName,
        age: payload.age,
        whatsapp: payload.whatsapp,
        email: payload.email,
        interests: payload.interests,
        ai_experience: payload.aiExperience,
        expectations: payload.expectations,
        child_name: payload.childName,
        ai_frequency: payload.aiFrequency,
        ai_tools: payload.aiTools.trim() ? [payload.aiTools.trim()] : [],
        experiences: payload.experiences,
        creative_score: payload.scores.creative,
        communicator_score: payload.scores.communicator,
        integrator_score: payload.scores.integrator,
        explorer_score: payload.scores.explorer,
        core_strength: payload.coreStrength,
        supporting_strength: payload.supportingStrength,
        next_skill: payload.nextSkill,
        scenario: payload.scenario,
        challenge_problem: payload.challengeProblem,
        challenge_solution: payload.challengeSolution,
        answers: payload.answers
      });
      if (error) throw error;
      setSavedToServer(true);
    } catch (error) {
      localStorage.setItem(`kidspreneur-result-${submissionId}`, JSON.stringify(payload));
      setSavedToServer(false);
    }
    setResult({ scores, ranking });
    setSubmitting(false);
    setScreen("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (screen === "welcome") return <Welcome onStart={() => setScreen("identity")} />;
  if (screen === "identity") return <Identity form={form} setForm={setForm} onNext={() => setScreen("context")} />;
  if (screen === "context") return <Context context={context} setContext={setContext} onBack={() => setScreen("identity")} onNext={() => { setQuestionIndex(0); setScreen("questions"); }} />;
  if (screen === "questions") return <Question index={questionIndex} answer={answers[questionIndex]} onAnswer={(value) => setAnswers({ ...answers, [questionIndex]: value })} onBack={goBackFromQuestion} onNext={() => { if (questionIndex === QUESTIONS.length - 1) setScreen("challenge-select"); else { setQuestionIndex(questionIndex + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } }} />;
  if (screen === "challenge-select") return <ChallengeSelection selected={selectedChallenge} onSelect={(value) => { setSelectedChallenge(value); setChallengeAnswer(""); }} onBack={() => { setQuestionIndex(QUESTIONS.length - 1); setScreen("questions"); }} onNext={() => { setScreen("challenge"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />;
  if (screen === "challenge") return <Challenge selected={selectedChallenge} response={challengeAnswer} setResponse={setChallengeAnswer} onBack={() => { setScreen("challenge-select"); window.scrollTo({ top: 0, behavior: "smooth" }); }} onNext={submit} submitting={submitting} />;
  return <Result result={result} savedToServer={savedToServer} onRestart={restart} />;
}

export default App;
