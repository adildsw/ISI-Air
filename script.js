let selectedSet = document.getElementById("set-test-btn");
let selectedClass = document.getElementById(`class-0-btn`);
let selectedSample = 0;
let selectedCoords = [
  [0, 0],
  [1, 1],
];
let selectedPointIdx = 0;

const toggleMenu = () => {
  const menu = document.getElementById("menu");
  if (menu.classList.contains("hidden")) {
    menu.classList.remove("hidden");
  } else {
    menu.classList.add("hidden");
  }
};

// if i click outside the menu, close it
window.onclick = (event) => {
  const menu = document.getElementById("menu");
  const menuButton = document.getElementById("menu-btn");
  if (
    !menu.contains(event.target) &&
    !menuButton.contains(event.target) &&
    !menu.classList.contains("hidden")
  ) {
    menu.classList.add("hidden");
  }
};

const coordPointSlider = document.getElementById("point-slider");
coordPointSlider.addEventListener("input", (event) => {
  selectedPointIdx = parseInt(event.target.value);
  if (selectedCoords.length < selectedPointIdx) return;
  draw(selectedCoords.slice(0, selectedPointIdx + 1));
});

const loadSample = async () => {
  const sampleDir = getSampleDir();
  const response = await fetch(sampleDir);
  const buffer = await response.arrayBuffer();
  const arr = npy.frombuffer(buffer);
  selectedCoords = toCoords(arr.data, arr.shape, true);
  console.log(selectedCoords.length);

  const slider = document.getElementById("point-slider");
  slider.max = selectedCoords.length - 1;
  slider.value = selectedCoords.length - 1;
  draw(selectedCoords);

  return selectedCoords;
};

const selectElement = (previous, current) => {
  if (previous) {
    previous.classList.remove(
      "border-slate-200",
      "bg-slate-100",
      "font-semibold"
    );
    previous.classList.add(
      "border-slate-100",
      "hover:bg-slate-100",
      "cursor-pointer"
    );
  }

  current.classList.add("border-slate-200", "bg-slate-100", "font-semibold");
  current.classList.remove(
    "hover:bg-slate-100",
    "border-slate-100",
    "cursor-pointer"
  );
};

const selectSet = (setId) => {
  const newSelectedSet =
    setId === "test"
      ? document.getElementById("set-test-btn")
      : document.getElementById("set-train-btn");
  selectElement(selectedSet, newSelectedSet);
  selectedSet = newSelectedSet;
  loadRandomSample();
  document.getElementById("set-value").innerText = setId === "test" ? "Test" : "Train";
};

const selectClass = (classId) => {
  const newSelectedClass = document.getElementById("class-" + classId + "-btn");
  selectElement(selectedClass, newSelectedClass);
  selectedClass = newSelectedClass;
  loadRandomSample();
  document.getElementById("class-value").innerText = classId;
};

const loadRandomSample = () => {
  selectedSample = getRandomSample();
  loadSample();
  document.getElementById("sample-value").innerText = "#" + selectedSample;
};

const downloadSample = () => {
  const sampleDir = getSampleDir();
  window.open(sampleDir, "_blank");
};

window.onload = async () => {
  selectSet(getRandomSet());
  selectClass(getRandomClass());
  loadRandomSample();
};

// |------------------------------|
// | CANVAS FUNCTIONS             |
// |------------------------------|
const draw = (coords) => {
  const canvas = document.getElementById("canvas");
  const ctx = setupHiDPICanvas(canvas);
  ctx.imageSmoothingEnabled = true;

  let idx = 0;
  coords.forEach(([x, y]) => {
    const px = x * canvas.getBoundingClientRect().width;
    const py = y * canvas.getBoundingClientRect().height;
    ctx.beginPath();
    if (idx < selectedCoords.length - 1)
      ctx.arc(px, py, idx === 0 ? 4 : 2, 0, Math.PI * 2);
    else ctx.rect(px - 4, py - 4, 8, 8);
    ctx.fillStyle = "black";
    ctx.fill();

    if (idx > 0) {
      const [prevX, prevY] = coords[idx - 1];
      const prevPx = prevX * canvas.getBoundingClientRect().width;
      const prevPy = prevY * canvas.getBoundingClientRect().height;
      ctx.beginPath();
      ctx.moveTo(prevPx, prevPy);
      ctx.lineTo(px, py);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    idx++;
  });
};

const playAnimation = () => {
  let idx = 0;
  const interval = setInterval(() => {
    if (idx >= selectedCoords.length) {
      clearInterval(interval);
      return;
    }
    coordPointSlider.value = idx;
    draw(selectedCoords.slice(0, idx + 1));
    idx++;
  }, 100);
};

// |------------------------------|
// | UTILITY FUNCTIONS            |
// |------------------------------|
const normalizeSquareCentered = (data, rows, cols, padding = 0.1) => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < rows; i++) {
    const x = data[i * cols],
      y = data[i * cols + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  let spanX = maxX - minX;
  let spanY = maxY - minY;
  minX -= padding * spanX;
  maxX += padding * spanX;
  minY -= padding * spanY;
  maxY += padding * spanY;
  spanX = maxX - minX;
  spanY = maxY - minY;

  const range = Math.max(spanX, spanY);
  const out = [];
  if (range === 0) {
    for (let i = 0; i < rows; i++) out.push(0.5, 0.5);
    return out;
  }

  let minXc = minX,
    minYc = minY;
  if (spanX < range) minXc -= (range - spanX) / 2;
  if (spanY < range) minYc -= (range - spanY) / 2;

  for (let i = 0; i < rows; i++) {
    const x = data[i * cols],
      y = data[i * cols + 1];
    out.push((x - minXc) / range, (y - minYc) / range);
  }
  return out;
};

const toCoords = (data, shape, normalized = false) => {
  const [rows, cols] = shape;
  if (cols !== 2) throw new Error("Shape must have 2 columns for (x,y) pairs");

  const normalizedData = [];
  if (normalized)
    normalizedData.push(...normalizeSquareCentered(data, rows, cols, 0.1));
  else normalizedData.push(...data);

  const coords = [];
  for (let i = 0; i < rows; i++) {
    const x = normalizedData[i * cols];
    const y = normalizedData[i * cols + 1];
    coords.push([x, y]);
  }
  return coords;
};

const setupHiDPICanvas = (canvas) => {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return ctx;
};

const getSampleMin = () => (selectedSet.id === "set-test-btn" ? 1000 : 0);
const getSampleMax = () => (selectedSet.id === "set-test-btn" ? 1199 : 999);

const getSampleDir = () => {
  const set = selectedSet.id === "set-test-btn" ? "test" : "train";
  const classId = selectedClass ? selectedClass.id.split("-")[1] : "0";
  const sampleId = selectedSample.toString();
  return `./isi-air-dataset/${set}/${classId}/${sampleId}.npy`;
};

const getRandomSample = () => {
  return (
    Math.floor(Math.random() * (getSampleMax() - getSampleMin() + 1)) +
    getSampleMin()
  );
};

const getRandomClass = () => {
  return Math.floor(Math.random() * 10).toString();
};

const getRandomSet = () => {
  return Math.random() < 0.5 ? "test" : "train";
};
// |------------------------------|
