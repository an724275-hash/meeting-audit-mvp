const $ = (id) => document.getElementById(id);
const recordButton = $("recordButton");
const transcribeButton = $("transcribeButton");
const analyzeButton = $("analyzeButton");
const audioFile = $("audioFile");
const playback = $("playback");
const status = $("status");
const transcript = $("transcript");
const report = $("report");
const apiKey = $("apiKey");
let mode = null;
let apiMaxMb = 25;
let recorder;
let stream;
let chunks = [];
let selectedAudio;
let startedAt;
let timerInterval;
let audioUrl;

function selectMode(nextMode) {
  mode = nextMode;
  $("modeScreen").hidden = true;
  $("appScreen").hidden = false;
  $("changeModeButton").hidden = false;
  $("apiPanel").hidden = mode !== "api";
  $("modeLabel").textContent = mode === "api" ? "OPENAI API" : "ЛОКАЛЬНЫЙ РЕЖИМ";
  $("fileHint").textContent = `m4a, mp3, wav, webm, ogg, mp4 · до ${mode === "api" ? apiMaxMb : 100} МБ`;
  $("privacyNote").textContent = mode === "api"
    ? "Аудио и текст отправляются в OpenAI. Обработка оплачивается по тарифам API."
    : "Аудио обрабатывается локально. Текст для анализа отправляется в Codex.";
  setStatus("Готово к записи или загрузке аудио.");
  window.scrollTo({ top: 0, behavior: "instant" });
}

document.querySelectorAll(".mode-option").forEach((button) => {
  button.addEventListener("click", () => selectMode(button.dataset.mode));
});

fetch("/api/health")
  .then((response) => response.json())
  .then((config) => {
    apiMaxMb = config.api_max_mb || 25;
    if (!config.local_available) {
      const localButton = document.querySelector('.mode-option[data-mode="local"]');
      localButton.disabled = true;
      localButton.querySelector("small").textContent = "Только после запуска на компьютере";
    }
  })
  .catch(() => {});

$("changeModeButton").addEventListener("click", () => {
  if (recorder?.state === "recording") {
    recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    recordButton.classList.remove("is-recording");
    $("recordLabel").textContent = "Начать запись";
    stopTimer();
  }
  apiKey.value = "";
  mode = null;
  $("modeScreen").hidden = false;
  $("appScreen").hidden = true;
  $("changeModeButton").hidden = true;
  window.scrollTo({ top: 0, behavior: "instant" });
});

function currentKey() {
  if (mode !== "api") return "";
  const key = apiKey.value.trim();
  if (!key) {
    setStatus("Введи ключ OpenAI API, чтобы продолжить.", "error");
    apiKey.focus();
    return null;
  }
  return key;
}

function setStatus(message, kind = "normal") {
  status.textContent = message;
  status.dataset.kind = kind;
}

function setAudio(blob, name) {
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  selectedAudio = new File([blob], name, {
    type: blob.type || "application/octet-stream",
  });
  audioUrl = URL.createObjectURL(selectedAudio);
  playback.src = audioUrl;
  playback.hidden = false;
  $("fileName").textContent =
    `${name} · ${(selectedAudio.size / 1024 / 1024).toFixed(1)} МБ`;
  transcribeButton.disabled = false;
  setStatus("Запись готова. Можно расшифровать.");
}

function stopTimer() {
  clearInterval(timerInterval);
  $("recordTimer").textContent = "00:00";
}

recordButton.addEventListener("click", async () => {
  if (recorder?.state === "recording") {
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
    recordButton.classList.remove("is-recording");
    $("recordLabel").textContent = "Начать запись";
    stopTimer();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus(
      "Этот браузер не поддерживает запись. Загрузите аудиофайл.",
      "error",
    );
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const ext = recorder.mimeType.includes("mp4") ? "mp4" : "webm";
      if (blob.size)
        setAudio(
          blob,
          `встреча-${new Date().toISOString().slice(0, 10)}.${ext}`,
        );
    };
    recorder.start(1000);
    startedAt = Date.now();
    recordButton.classList.add("is-recording");
    $("recordLabel").textContent = "Остановить запись";
    $("recordTimer").textContent = "00:00";
    timerInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      $("recordTimer").textContent =
        `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }, 1000);
    setStatus(
      "Идёт запись. Нажмите «Остановить запись», когда разговор закончится.",
      "busy",
    );
  } catch (error) {
    setStatus(
      "Нет доступа к микрофону. Разрешите его в браузере или загрузите аудио.",
      "error",
    );
  }
});

audioFile.addEventListener("change", () => {
  const file = audioFile.files?.[0];
  if (!file) return;
  const maxMb = mode === "api" ? apiMaxMb : 100;
  if (file.size > maxMb * 1024 * 1024) {
    setStatus(`Файл больше ${maxMb} МБ. Выберите запись поменьше.`, "error");
    audioFile.value = "";
    return;
  }
  setAudio(file, file.name);
});
$("uploadButton").addEventListener("click", () => audioFile.click());

async function readError(response) {
  try {
    const body = await response.json();
    return body.detail || "Ошибка сервера";
  } catch {
    return `Сервис вернул HTTP ${response.status}`;
  }
}

transcribeButton.addEventListener("click", async () => {
  if (!selectedAudio) return;
  const key = currentKey();
  if (key === null) return;
  const maxMb = mode === "api" ? apiMaxMb : 100;
  if (selectedAudio.size > maxMb * 1024 * 1024) {
    setStatus(`Для этого режима нужен файл до ${maxMb} МБ.`, "error");
    return;
  }
  transcribeButton.disabled = true;
  setStatus(
    "Расшифровка идёт. Длинная запись может занять несколько минут.",
    "busy",
  );
  const form = new FormData();
  form.append("audio", selectedAudio);
  form.append("mode", mode);
  if (key) form.append("api_key", key);
  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: form,
    });
    if (!response.ok) throw new Error(await readError(response));
    transcript.value = (await response.json()).transcript;
    setStatus("Расшифровка готова. Проверьте текст и запустите разбор.");
    transcript.focus();
  } catch (error) {
    setStatus(`Расшифровка не удалась: ${error.message}`, "error");
  } finally {
    transcribeButton.disabled = false;
  }
});

analyzeButton.addEventListener("click", async () => {
  const text = transcript.value.trim();
  if (text.length < 20) {
    setStatus(
      "Сначала расшифруйте запись или вставьте текст разговора.",
      "error",
    );
    transcript.focus();
    return;
  }
  const key = currentKey();
  if (key === null) return;
  analyzeButton.disabled = true;
  setStatus("Анализ встречи идёт. Это может занять несколько минут.", "busy");
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: text,
        manager: $("manager").value.trim() || "не указан",
        meeting_date: $("meetingDate").value || "не указана",
        mode,
        api_key: key,
      }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const result = await response.json();
    report.innerHTML = result.html;
    report.dataset.markdown = result.report;
    report.hidden = false;
    $("reportEmpty").hidden = true;
    $("downloadButton").disabled = false;
    setStatus("Разбор готов. Проверьте выводы по расшифровке.");
    $("report-title").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    setStatus(`Анализ не удался: ${error.message}`, "error");
  } finally {
    analyzeButton.disabled = false;
  }
});

$("downloadButton").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([report.dataset.markdown], {
      type: "text/markdown;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "royal-brick-report.md";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
