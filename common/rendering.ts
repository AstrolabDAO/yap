function createSeedArr(s: string): number[] {
  let seed: number[] = new Array(4).fill(0);
  for (let i = 0; i < s.length; i++) {
    seed[i % 4] = ((seed[i % 4] << 5) - seed[i % 4]) + s.charCodeAt(i);
  }
  return seed;
}

function generateHash(length: number = 16): string {
  let s = "";
  while (s.length < length) {
    s += Math.random().toString(36).substring(2, 15);
  }
  return s.substring(0, length);
}

function rand(seed: number[]): number {
  const t = seed[0] ^ (seed[0] << 11);
  seed[0] = seed[1];
  seed[1] = seed[2];
  seed[2] = seed[3];
  seed[3] = (seed[3] ^ (seed[3] >>> 19) ^ t ^ (t >>> 8)) >>> 0;
  return seed[3] / ((1 << 31) >>> 0);
}

function randColor(seed: number[] = createSeedArr(generateHash(16))): string {
  const h = Math.floor(rand(seed) * 360);
  const s = `${(rand(seed) * 60) + 40}%`;
  const l = `${((rand(seed) + rand(seed) + rand(seed) + rand(seed)) * 25) + 25}%`;
  return `hsl(${h},${s},${l})`;
}

class Blocky {
  static resource: string = "BLOCKY";
  seed: string;
  seedArr: number[];
  size: number;
  scale: number;
  bgColor: string;
  color: string;
  spotColor: string;
  canvas?: HTMLCanvasElement;
  dataUrl: string = "";
  rendered: boolean = false;

  constructor(o: Partial<Blocky> = {}, render = true) {
    this.seed = o.seed || generateHash(16);
    this.seedArr = createSeedArr(this.seed);
    this.size = o.size || 7;
    this.scale = o.scale || 5;
    this.bgColor = o.bgColor || randColor(this.seedArr);
    this.color = o.color || randColor(this.seedArr);
    this.spotColor = o.spotColor || randColor(this.seedArr);
    this.dataUrl = o.dataUrl || "";
    this.rendered = !!this.dataUrl;

    if (render && !this.rendered) {
      this.render();
    }
    // Store[Blocky.resource].add(this); // Uncomment if using a store
  }

  private createImageData(size: number, seed: number[]): number[] {
    const width = size;
    const height = size;

    const dataWidth = Math.ceil(width / 2);
    const mirrorWidth = width - dataWidth;

    const data: number[] = [];

    for (let y = 0; y < height; y++) {
      let row: number[] = [];
      for (let x = 0; x < dataWidth; x++) {
        row[x] = Math.floor(rand(seed) * 2.3); // Randomly 0, 1, or 2
      }
      const mirroredRow = [...row.slice(0, mirrorWidth).reverse(), ...row];

      data.push(...mirroredRow);
    }

    return data;
  }

  render(): string {
    if (this.rendered && this.canvas) {
      return this.dataUrl;
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = this.size * this.scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('2d context creation failure');
      return "";
    }

    const imageData = this.createImageData(this.size, this.seedArr);
    const width = Math.sqrt(imageData.length);

    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < imageData.length; i++) {
      if (imageData[i]) {
        const row = Math.floor(i / width);
        const col = i % width;

        ctx.fillStyle = (imageData[i] === 1) ? this.color : this.spotColor;
        ctx.fillRect(col * this.scale, row * this.scale, this.scale, this.scale);
      }
    }

    this.dataUrl = canvas.toDataURL();
    this.rendered = true;
    return this.dataUrl;
  }

  getDataUrl(): string {
    return this.rendered ? this.dataUrl : this.render();
  }

  static dummy(): Blocky {
    return new Blocky({});
  }
}

export { Blocky };
