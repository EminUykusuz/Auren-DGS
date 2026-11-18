import puppeteer from 'puppeteer-core'; import { pathToFileURL } from 'node:url'; import path from 'node:path';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });
await p.goto(pathToFileURL(path.resolve('video.html')).href); await p.evaluate(() => window.seek(3.5));
console.log(JSON.stringify(await p.evaluate(() => document.getElementById("t1a").dataset.split)));
console.log(await p.evaluate(() => [...document.querySelectorAll('#t1a .w')].map(e => JSON.stringify([e.textContent, getComputedStyle(e).display, e.getBoundingClientRect().x|0, e.getBoundingClientRect().width|0]))));
await b.close();
