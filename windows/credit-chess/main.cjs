const { app, BrowserWindow, shell } = require('electron');
const START_URL = 'https://ae6820dc.github.io/chess/credit-chess/stockfish-19/desktop.html';
app.whenReady().then(() => {
  const win = new BrowserWindow({width: 1360,height: 900,minWidth: 900,minHeight: 650,autoHideMenuBar: true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.webContents.setWindowOpenHandler(({url}) => {if(url.startsWith('https://')) shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('https://ae6820dc.github.io/chess/credit-chess/stockfish-19/')){event.preventDefault();if(url.startsWith('https://'))shell.openExternal(url);}});
  win.loadURL(START_URL);
});
app.on('window-all-closed',()=>app.quit());
