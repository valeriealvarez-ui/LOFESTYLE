
"use strict";

/* LOFESTYLE — versión con estilos y combinaciones más estrictas */
const MAX_PRENDAS = 20;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DB_NAME = "lofestyle_db";
const DB_VERSION = 1;

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "lofe-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12);
}

class StorageManager {
  constructor() { this.dbPromise = this.openDatabase(); }

  openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("Este navegador no admite IndexedDB."));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        ["garments", "outfits", "events"].forEach(name => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error("No se pudo abrir la base de datos."));
      request.onblocked = () => console.warn("El almacenamiento está bloqueado por otra pestaña.");
    });
  }

  async all(storeName) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error || new Error("No se pudieron leer los datos."));
    });
  }

  async put(storeName, item) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(item);
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error || new Error("No se pudo guardar."));
      tx.onabort = () => reject(tx.error || new Error("Se canceló el guardado."));
    });
  }

  async remove(storeName, id) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("No se pudo eliminar."));
    });
  }

  async log(event) {
    const record = { ...event, id: createId(), date: new Date().toISOString() };
    await this.put("events", record);
    return record;
  }

  async events() {
    return (await this.all("events")).sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

class Garment {
  constructor({ id = createId(), name, category, color = "", style = "versatil", image, createdAt = new Date().toISOString(), usedIn = [] }) {
    Object.assign(this, { id, name, category, color, style, image, createdAt, usedIn });
  }
}

class Outfit {
  constructor({ id = createId(), title, occasion, garmentIds, createdAt = new Date().toISOString() }) {
    Object.assign(this, { id, title, occasion, garmentIds, createdAt });
  }
}

class FashionAssistant {
  constructor(app) { this.app = app; }

  normalize(value) {
    return String(value || "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  typeOf(g) {
    const text = this.normalize(`${g.category || ""} ${g.name || ""}`);
    if (/vestido|enterizo|mono largo/.test(text)) return "vestido";
    if (/blusa|camisa|camiseta|top|polo|crop|sueter|sudadera|buso|jersey/.test(text)) return "superior";
    if (/pantalon|jean|vaquero|falda|short|bermuda|legging|leggins|licra/.test(text)) return "inferior";
    if (/chaqueta|abrigo|blazer|cardigan|chaleco/.test(text)) return "abrigo";
    if (/tenis|zapatilla|zapato|bota|sandalia|mocasin|calzado/.test(text)) return "calzado";
    if (/accesorio|bolso|cartera|gorra|sombrero|cinturon|bufanda/.test(text)) return "accesorio";
    return "otro";
  }

  inferStyle(g) {
    const explicit = this.normalize(g.style || "");
    if (["casual", "universidad", "sport", "elegante"].includes(explicit)) return explicit;
    const text = this.normalize(`${g.name || ""} ${g.category || ""}`);
    if (/deportiv|sport|gym|gimnasio|running|entrenamiento|fitness|dry fit|legging deportivo/.test(text)) return "sport";
    if (/elegante|formal|fiesta|gala|blazer formal|vestido de noche|tacon|tacones|mocasin/.test(text)) return "elegante";
    if (/universidad|universitario|clase|estudio|mochila/.test(text)) return "universidad";
    return "versatil";
  }

  detectOccasion(message) {
    const text = this.normalize(message);
    if (/\bsport\b|deportiv|gimnasio|entrenamiento|ejercicio|fitness|running/.test(text)) return "sport";
    if (/elegante|formal|fiesta|evento|graduacion|gala/.test(text)) return "elegante";
    if (/universidad|universitario|universitaria|clase|estudiar|estudio/.test(text)) return "universidad";
    return "casual";
  }

  colorScore(a, b) {
    const getColors = g => {
      const text = this.normalize(`${g.color || ""} ${g.name || ""}`);
      return ["negro","blanco","gris","beige","crema","azul marino","azul","celeste","rojo","rosa","rosado","verde","cafe","marron","vinotinto","morado","lila","amarillo","naranja"]
        .filter(c => text.includes(c));
    };
    const ca = getColors(a), cb = getColors(b);
    if (!ca.length || !cb.length) return 1;
    const neutrals = ["negro","blanco","gris","beige","crema"];
    for (const x of ca) for (const y of cb) {
      if (x === y) return 3;
      if (neutrals.includes(x) || neutrals.includes(y)) return 3;
      if ((x.includes("azul") && ["cafe","marron","beige","crema"].includes(y)) ||
          (y.includes("azul") && ["cafe","marron","beige","crema"].includes(x))) return 2;
    }
    return 0;
  }

  getStyleScore(g, occasion) {
    const text = this.normalize(`${g.name || ""} ${g.category || ""}`);
    const type = this.typeOf(g);
    const style = this.inferStyle(g);
    let score = 0;

    if (style === occasion) score += 12;
    else if (style === "versatil") score += 3;
    else if ((occasion === "casual" && style === "universidad") ||
             (occasion === "universidad" && style === "casual")) score += 2;
    else score -= 12;

    if (occasion === "sport") {
      if (/deportiv|sport|running|gym|fitness|dry fit|licra|legging/.test(text)) score += 6;
      if (/tacon|tacones|vestido|blazer formal|gala|mocasin/.test(text)) score -= 15;
    }
    if (occasion === "elegante") {
      if (/formal|elegante|blazer|vestido|camisa|de vestir|tacon|mocasin|gala/.test(text)) score += 4;
      if (/deportiv|running|gym|sudadera deportiva|licra/.test(text)) score -= 15;
    }
    if (occasion === "casual" || occasion === "universidad") {
      if (/pijama|pantufla|bata|traje de gala/.test(text)) score -= 12;
    }
    if (["superior", "inferior", "vestido"].includes(type)) score += 2;
    return score;
  }

  replyTo(message) {
    const garments = this.app.garments;
    if (!garments.length) return { text: "Primero agrega algunas prendas a Mi Armario Virtual para crear outfits." };

    const occasion = this.detectOccasion(message);
    const occasionNames = { casual: "casual", universidad: "para la universidad", sport: "deportivo", elegante: "elegante" };
    const allScored = garments.map(g => ({ garment: g, score: this.getStyleScore(g, occasion) }));
    let candidates = allScored.filter(x => x.score >= 0).map(x => x.garment);

    candidates = candidates.filter(g => {
      const style = this.inferStyle(g);
      if (style === "versatil" || style === occasion) return true;
      return (occasion === "casual" && style === "universidad") ||
             (occasion === "universidad" && style === "casual");
    });

    if (!candidates.length) {
      return { text: `No encuentro prendas marcadas para un look ${occasionNames[occasion]}. Agrega prendas de ese estilo o marca algunas como “Versátil”.` };
    }

    const scoreFor = g => this.getStyleScore(g, occasion);
    const chosen = [];
    const used = new Set();
    const addBest = type => {
      const options = candidates.filter(g => this.typeOf(g) === type && !used.has(g.id));
      if (!options.length) return;
      options.sort((a, b) => {
        const sa = scoreFor(a) + chosen.reduce((n, x) => n + this.colorScore(a, x), 0);
        const sb = scoreFor(b) + chosen.reduce((n, x) => n + this.colorScore(b, x), 0);
        return sb - sa;
      });
      chosen.push(options[0]); used.add(options[0].id);
    };

    const dresses = candidates.filter(g => this.typeOf(g) === "vestido");
    const tops = candidates.filter(g => this.typeOf(g) === "superior");
    const bottoms = candidates.filter(g => this.typeOf(g) === "inferior");

    if (dresses.length && (!tops.length || !bottoms.length)) {
      addBest("vestido");
    } else {
      addBest("superior");
      addBest("inferior");
      if (chosen.length < 2 && dresses.length) {
        chosen.length = 0; used.clear(); addBest("vestido");
      }
    }

    
    for (const type of ["calzado", "abrigo", "accesorio"]) {
      if (chosen.length >= 4) break;
      const options = candidates.filter(g => this.typeOf(g) === type && !used.has(g.id));
      if (!options.length) continue;
      options.sort((a, b) => {
        const sa = scoreFor(a) + chosen.reduce((n, x) => n + this.colorScore(a, x), 0);
        const sb = scoreFor(b) + chosen.reduce((n, x) => n + this.colorScore(b, x), 0);
        return sb - sa;
      });
      const best = options[0];
      const compatibleStyle = chosen.every(g => {
        const a = this.inferStyle(best), b = this.inferStyle(g);
        return a === "versatil" || b === "versatil" || a === b ||
          (["casual","universidad"].includes(a) && ["casual","universidad"].includes(b));
      });
      const harmony = chosen.reduce((n, g) => n + this.colorScore(best, g), 0);
      if (compatibleStyle && harmony >= 0) { chosen.push(best); used.add(best.id); }
    }

    if (!chosen.length) return { text: `No hay suficientes prendas compatibles para un look ${occasionNames[occasion]}. Prueba con otro estilo o agrega más prendas.` };

    const hasDress = chosen.some(g => this.typeOf(g) === "vestido");
    const hasTop = chosen.some(g => this.typeOf(g) === "superior");
    const hasBottom = chosen.some(g => this.typeOf(g) === "inferior");
    if (!hasDress && !(hasTop && hasBottom)) {
      return { text: `Me faltan prendas principales compatibles para completar el outfit ${occasionNames[occasion]}. Agrega una parte superior y una inferior, o un vestido.` };
    }

    return {
      text: `¡Preparé un outfit ${occasionNames[occasion]}! Elegí prendas según el estilo que tienen guardado, el tipo de prenda y la armonía de los colores. Si una prenda está marcada con otro estilo, no la mezclaré solo porque combine por color.`,
      chosen,
      occasion: `Look ${occasionNames[occasion]}`
    };
  }
}

class LofestyleApp {
  constructor() {
    this.store = new StorageManager();
    this.garments = [];
    this.outfits = [];
    this.assistant = new FashionAssistant(this);
    this.$ = id => document.getElementById(id);
    this.toastTimer = null;
    this.isReady = false;
    this.isSavingGarment = false;
    this.isSendingMessage = false;
    this.ensureStyleField();
    this.bindEvents();
    this.init();
  }

  ensureStyleField() {
    const category = this.$("garmentCategory");
    if (!category || this.$("garmentStyle")) return;
    const label = document.createElement("label");
    label.className = "field";
    label.append(document.createTextNode("Estilo de la prenda"));
    const select = document.createElement("select");
    select.id = "garmentStyle";
    select.required = true;
    [
      ["casual","Casual"], ["universidad","Universidad"],
      ["sport","Sport / Deportivo"], ["elegante","Elegante"],
      ["versatil","Versátil (combina con varios estilos)"]
    ].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value; option.textContent = text;
      select.append(option);
    });
    const hint = document.createElement("small");
    hint.textContent = "Elige el estilo para que las combinaciones sean más acertadas.";
    label.append(select, hint);
    category.closest("label")?.insertAdjacentElement("afterend", label);
  }

  async init() {
    const notice = this.$("storageNotice");
    try {
      const [garments, outfits] = await Promise.all([this.store.all("garments"), this.store.all("outfits")]);
      this.garments = garments.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
      this.outfits = outfits.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
      this.isReady = true;
      this.renderAll();
      if (notice) notice.textContent = "✓ Almacenamiento local activo. Tus prendas y outfits se guardan en este navegador.";
      if (navigator.storage?.persist) navigator.storage.persist().catch(console.warn);
    } catch (error) {
      console.error("Error al iniciar LOFESTYLE:", error);
      if (notice) notice.textContent = "No se pudo activar el almacenamiento. Abre la app con Live Server y revisa la consola.";
      this.toast("Error al abrir el almacenamiento. Revisa la consola con F12.");
    }
  }

  bindEvents() {
    this.$("uploadForm")?.addEventListener("submit", e => { e.preventDefault(); this.addGarment(); });
    this.$("chatForm")?.addEventListener("submit", e => { e.preventDefault(); this.sendMessage(); });
    document.querySelectorAll(".suggestion").forEach(button => button.addEventListener("click", () => {
      const input = this.$("chatInput");
      if (input) { input.value = button.textContent.trim(); input.focus(); }
    }));
    this.$("wardrobeGrid")?.addEventListener("click", e => {
      const button = e.target.closest("[data-action]");
      if (!button) return;
      const garment = this.garments.find(g => g.id === button.dataset.id);
      if (button.dataset.action === "delete") this.deleteGarment(garment);
      if (button.dataset.action === "edit") this.editGarment(garment);
    });
    this.$("looksGrid")?.addEventListener("click", e => {
      const button = e.target.closest("[data-action='delete-look']");
      if (button) this.deleteOutfit(button.dataset.id);
    });
    document.querySelectorAll(".nav a").forEach(link => link.addEventListener("click", () => {
      document.querySelectorAll(".nav a").forEach(item => item.classList.remove("active"));
      link.classList.add("active");
    }));
  }

  async addGarment() {
    if (!this.isReady) return this.toast("Espera un momento mientras se prepara el almacenamiento.");
    if (this.isSavingGarment) return;
    const form = this.$("uploadForm"), nameInput = this.$("garmentName"),
      categoryInput = this.$("garmentCategory"), colorInput = this.$("garmentColor"),
      styleInput = this.$("garmentStyle"), photoInput = this.$("garmentPhoto"),
      submit = this.$("uploadButton");
    if (!form || !nameInput || !categoryInput || !photoInput) return this.toast("Faltan campos del formulario. Revisa index.html.");
    if (this.garments.length >= MAX_PRENDAS) return this.toast(`Llegaste al límite de ${MAX_PRENDAS} prendas.`);
    const name = nameInput.value.trim(), category = categoryInput.value,
      color = colorInput ? colorInput.value.trim() : "",
      style = styleInput ? styleInput.value : "versatil",
      file = photoInput.files?.[0];
    if (!name) { this.toast("Escribe el nombre de la prenda."); nameInput.focus(); return; }
    if (!file) { this.toast("Selecciona una foto de la prenda."); photoInput.focus(); return; }
    if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) return this.toast("Usa una imagen JPG, PNG, WEBP o GIF.");
    if (file.size > MAX_IMAGE_BYTES) return this.toast("La imagen supera los 8 MB. Selecciona una más pequeña.");
    if (!file.size) return this.toast("El archivo está vacío. Selecciona otra imagen.");
    this.isSavingGarment = true;
    if (submit) { submit.disabled = true; submit.textContent = "Guardando..."; }
    try {
      const image = await this.readImage(file);
      if (this.garments.length >= MAX_PRENDAS) return this.toast("Tu armario ya tiene 20 prendas.");
      const garment = new Garment({ name, category, color, style, image });
      await this.store.put("garments", garment);
      this.garments.unshift(garment);
      this.renderAll(); form.reset();
      this.toast("¡Prenda guardada correctamente!");
      try {
        await this.store.log({ type:"prenda_agregada", garmentId:garment.id, garmentName:garment.name, detail:`Se agregó ${garment.name} · estilo ${style}` });
      } catch (error) { console.error("No se pudo guardar el evento del historial:", error); }
    } catch (error) {
      console.error("Error al guardar la prenda:", error);
      this.toast(error?.name === "QuotaExceededError" ? "El almacenamiento está lleno. Prueba con una imagen más pequeña." : "No se pudo guardar la prenda. Revisa el almacenamiento y la consola.");
    } finally {
      this.isSavingGarment = false;
      if (submit) { submit.disabled = false; submit.textContent = "＋ Agregar prenda"; }
    }
  }

  readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("No se pudo procesar la imagen."));
      reader.onerror = () => reject(reader.error || new Error("Error al leer la imagen."));
      reader.onabort = () => reject(new Error("Se canceló la lectura de la imagen."));
      reader.readAsDataURL(file);
    });
  }

  async editGarment(garment) {
    if (!garment) return;

    const name = prompt("Nombre de la prenda:", garment.name);
    if (name === null) return;
    if (!name.trim()) return this.toast("El nombre no puede quedar vacío.");

    const categories = ["Blusas", "Pantalones", "Faldas", "Vestidos", "Chaquetas", "Zapatos", "Accesorios", "Otro"];
    const currentCategory = categories.findIndex(c => c.toLowerCase() === String(garment.category || "").toLowerCase());
    const categoryPrompt = categories.map((c, i) => `${i + 1}. ${c}`).join("\n");
    const categoryChoice = prompt(`Categoría de la prenda (escribe el número):\n${categoryPrompt}`, String(currentCategory >= 0 ? currentCategory + 1 : 8));
    if (categoryChoice === null) return;
    const categoryIndex = Number(categoryChoice) - 1;
    if (!Number.isInteger(categoryIndex) || categoryIndex < 0 || categoryIndex >= categories.length) {
      return this.toast("La categoría elegida no es válida.");
    }

    const color = prompt("Color de la prenda:", garment.color || "");
    if (color === null) return;

    const styles = [
      ["casual", "Casual"],
      ["universidad", "Universidad"],
      ["sport", "Sport / Deportivo"],
      ["elegante", "Elegante"],
      ["versatil", "Versátil"]
    ];
    const currentStyle = styles.findIndex(([value]) => value === (garment.style || "versatil"));
    const stylePrompt = styles.map(([value, label], i) => `${i + 1}. ${label}`).join("\n");
    const styleChoice = prompt(`Estilo de la prenda (escribe el número):\n${stylePrompt}`, String(currentStyle >= 0 ? currentStyle + 1 : 5));
    if (styleChoice === null) return;
    const styleIndex = Number(styleChoice) - 1;
    if (!Number.isInteger(styleIndex) || styleIndex < 0 || styleIndex >= styles.length) {
      return this.toast("El estilo elegido no es válido.");
    }

    const updated = {
      ...garment,
      name: name.trim(),
      category: categories[categoryIndex],
      color: color.trim(),
      style: styles[styleIndex][0]
    };

    try {
      await this.store.put("garments", updated);
      this.garments = this.garments.map(g => g.id === updated.id ? updated : g);
      this.renderAll();
      this.toast("¡Prenda actualizada correctamente!");
    } catch (error) {
      console.error("Error al editar la prenda:", error);
      this.toast("No se pudieron guardar los cambios.");
    }
  }

  async deleteGarment(garment) {
    if (!garment || !confirm(`¿Eliminar «${garment.name}» del armario?`)) return;
    try {
      await this.store.remove("garments", garment.id);
      this.garments = this.garments.filter(g => g.id !== garment.id);
      this.renderAll();
      try { await this.store.log({type:"prenda_eliminada", garmentId:garment.id, garmentName:garment.name, detail:`Se eliminó ${garment.name}`}); } catch (e) { console.error(e); }
      this.toast("Prenda eliminada.");
    } catch (error) { console.error(error); this.toast("No se pudo eliminar la prenda."); }
  }

  async sendMessage() {
    if (!this.isReady) return this.toast("Espera mientras se carga tu armario.");
    if (this.isSendingMessage) return;
    const input = this.$("chatInput");
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;
    this.isSendingMessage = true; input.value = ""; this.addChatMessage(message, "user");
    try {
      const result = this.assistant.replyTo(message);
      this.addChatMessage(result.text, "assistant");
      if (!result.chosen?.length) return;
      const outfit = new Outfit({ title:result.occasion, occasion:result.occasion, garmentIds:result.chosen.map(g=>g.id) });
      await this.store.put("outfits", outfit); this.outfits.unshift(outfit);
      try { await this.store.log({type:"outfit_creado", outfitId:outfit.id, detail:`Se creó ${outfit.title}`}); } catch(e) { console.error(e); }
      for (const garment of result.chosen) {
        garment.usedIn = [...new Set([...(garment.usedIn || []), outfit.id])];
        try { await this.store.put("garments", garment); } catch(e) { console.error(e); }
      }
      this.addOutfitToChat(outfit, result.chosen); this.renderAll(); this.toast("¡Outfit guardado en Mis Outfits! ✨");
    } catch (error) { console.error("Error al crear el outfit:", error); this.toast("No se pudo guardar el outfit."); }
    finally { this.isSendingMessage = false; input.focus(); }
  }

  addChatMessage(text, who) {
    const chat = this.$("chatWindow"); if (!chat) return;
    const wrap = document.createElement("div"); wrap.className = `message ${who}`;
    const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = who === "assistant" ? "L" : "Tú";
    const bubble = document.createElement("div"); bubble.className = "bubble";
    const paragraph = document.createElement("p"); paragraph.textContent = text;
    const time = document.createElement("span"); time.className = "time";
    time.textContent = new Date().toLocaleTimeString("es-CO", {hour:"2-digit", minute:"2-digit"});
    bubble.append(paragraph, time); wrap.append(avatar, bubble); chat.append(wrap); chat.scrollTop = chat.scrollHeight;
  }

  addOutfitToChat(outfit, garments) {
    const chat = this.$("chatWindow"); if (!chat) return;
    const wrap = document.createElement("div"); wrap.className = "message assistant";
    const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = "L";
    const bubble = document.createElement("div"); bubble.className = "bubble chat-outfit";
    const title = document.createElement("strong"); title.textContent = `✧ ${outfit.title}`;
    const collage = document.createElement("div"); collage.className = "outfit-collage";
    garments.forEach(g => {
      const figure = document.createElement("figure"), image = document.createElement("img"), caption = document.createElement("figcaption");
      image.src = g.image; image.alt = g.name; image.loading = "lazy"; caption.textContent = `${g.name} · ${this.assistant.inferStyle(g)}`;
      figure.append(image, caption); collage.append(figure);
    });
    const note = document.createElement("p"); note.textContent = "Outfit guardado en Mis Outfits.";
    bubble.append(title, collage, note); wrap.append(avatar, bubble); chat.append(wrap); chat.scrollTop = chat.scrollHeight;
  }

  async deleteOutfit(id) {
    if (!confirm("¿Eliminar este outfit guardado?")) return;
    try {
      await this.store.remove("outfits", id); this.outfits = this.outfits.filter(o=>o.id!==id);
      for (const g of this.garments) if ((g.usedIn||[]).includes(id)) {
        g.usedIn = g.usedIn.filter(x=>x!==id);
        try { await this.store.put("garments", g); } catch(e) { console.error(e); }
      }
      this.renderAll();
      try { await this.store.log({type:"outfit_eliminado", outfitId:id, detail:"Se eliminó un outfit"}); } catch(e) { console.error(e); }
      this.toast("Outfit eliminado.");
    } catch(error) { console.error(error); this.toast("No se pudo eliminar el outfit."); }
  }

  renderAll() {
    this.renderGarments(); this.renderOutfits();
    const counter = this.$("counter");
    if (counter) counter.textContent = `${this.garments.length} / ${MAX_PRENDAS} prendas`;
  }

  renderGarments() {
    const grid = this.$("wardrobeGrid"), empty = this.$("emptyWardrobe");
    if (!grid) return;
    grid.replaceChildren();
    this.garments.forEach(g => {
      const card = document.createElement("article"); card.className = "garment-card";
      const image = document.createElement("img"); image.src = g.image; image.alt = g.name; image.loading = "lazy";
      const title = document.createElement("h3"); title.textContent = g.name;
      const meta = document.createElement("p"); meta.className = "meta";
      meta.textContent = [g.category, g.color, this.assistant.inferStyle(g)].filter(Boolean).join(" · ");
      const actions = document.createElement("div"); actions.className = "card-actions";
      const edit = document.createElement("button"); edit.type="button"; edit.className="mini-btn"; edit.textContent="Editar prenda"; edit.dataset.action="edit"; edit.dataset.id=g.id;
      const del = document.createElement("button"); del.type="button"; del.className="mini-btn danger"; del.textContent="Eliminar"; del.dataset.action="delete"; del.dataset.id=g.id;
      actions.append(edit, del); card.append(image, title, meta, actions); grid.append(card);
    });
    if (empty) empty.hidden = this.garments.length > 0;
  }

  renderOutfits() {
    const grid = this.$("looksGrid"), empty = this.$("emptyLooks");
    if (!grid) return;
    grid.replaceChildren();
    [...this.outfits].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).forEach(outfit => {
      const garments = (Array.isArray(outfit.garmentIds)?outfit.garmentIds:[]).map(id=>this.garments.find(g=>g.id===id)).filter(Boolean);
      const card = document.createElement("article"); card.className="look-card";
      const title = document.createElement("h3"); title.textContent=outfit.title;
      const date = document.createElement("p"); date.textContent=new Date(outfit.createdAt).toLocaleString("es-CO");
      const thumbs = document.createElement("div"); thumbs.className="look-thumbs";
      garments.forEach(g=>{ const img=document.createElement("img"); img.src=g.image; img.alt=g.name; img.title=g.name; img.loading="lazy"; thumbs.append(img); });
      const del=document.createElement("button"); del.type="button"; del.className="mini-btn danger"; del.textContent="Eliminar outfit"; del.dataset.action="delete-look"; del.dataset.id=outfit.id;
      card.append(title,date,thumbs,del); grid.append(card);
    });
    if (empty) empty.hidden=this.outfits.length>0;
  }

  toast(message) {
    const element=this.$("toast");
    if(!element){console.log("[LOFESTYLE]",message);return;}
    element.textContent=message;element.classList.add("show");clearTimeout(this.toastTimer);
    this.toastTimer=setTimeout(()=>element.classList.remove("show"),3200);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  try { window.lofestyleApp = new LofestyleApp(); }
  catch(error) { console.error("No se pudo iniciar LOFESTYLE:",error); alert("No se pudo iniciar LOFESTYLE. Abre la consola con F12 para revisar el error."); }
});
