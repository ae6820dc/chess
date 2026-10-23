# PWA elkülönítés és ellenőrzés

## Megállapítások

A GitHub Pages projektek közös originje `https://ae6820dc.github.io`.
Az alkalmazásazonosító (`manifest.id`) nem azonos a Program ID-val vagy a
mentési kulccsal. A Chromium telepítési identitását a feloldott manifest ID
adja; a manifest `scope` az alkalmazáshoz tartozó navigációkat határozza meg.
A service worker regisztrációja ettől független.

A vizsgált jelenlegi manifestek **nem tartalmaztak azonos ID-t**. A Unicode
7/8/9 és az öt Calculator család változatai viszont családonként ugyanazt a
mappahatókört használták. Az egyik alkalmazás hatóköre így magába foglalta a
másik változat induló URL-jét is. Ez hibás indítási/telepítésfelismerési
konfiguráció, akkor is, ha az ID-k eltérnek. A javítás minden eredeti HTML
változat saját fájl-URL-jére szűkíti az alkalmazáshatókört. A fájlszintű scope
szabványos URL-prefix; nincs szükség a programok áthelyezésére.

A Chess és a 9062 jelenlegi mappahatókörei már a javítás előtt is különböztek.
Ezért a **minden projektet érintő, egyetlen telepíthető alkalmazás** jelenség
pontos oka a jelenlegi repositorykból nem bizonyítható. Ehhez a készüléken
korábban telepített WebAPK/shortcut manifest ID-ja, induló URL-je, hatóköre,
a Chrome verziója és az Android alapértelmezett linkkezelése is szükséges.
Egy korábbi, szélesebb hatókörű telepítés vagy régi manifest megmaradhat a
készüléken; a forrás frissítése nem írja át azonnal az Android telepítési adatait.
A GitHub Pages közös originje önmagában nem jelent azonos PWA-identitást.

Csak SVG ikonok szerepeltek. Az új 192/512 PNG és külön maskable bejegyzések
kiküszöbölik az Android/WebAPK ikontámogatási bizonytalanságát. Minden fő
változat feliratozott saját ikont kapott. A Chess új, állandó relatív ID-ja
`./tablet-app-v3`, induló URL-je `./tablet.html`, scope-ja `./tablet.html`,
display módja `fullscreen`. Az ID-t további kiadásoknál nem kell változtatni.
A Unicode/Calculator már egyedi ID-jait és eredeti induló URL-jeit megtartottuk.
A két meglévő Unicode 7 `install-sample` belépő is megmarad.

## Offline és adatmegőrzés

A Chess worker előkészíti a manifestet, PNG-ket, HTML/CSS/JS fájlokat,
a chess.js-t, valamint a Stockfish JS/WASM párost. Az NNUE háló a lite-single
WASM-ba van beágyazva; külön hálózati letöltés nem szükséges. A korábbi
`tablet.html?standalone=2` navigáció offline a kanonikus tablet.html-re esik
vissza. JS/WASM kérések soha nem kapnak helyette HTML-t.

A workerek saját cache-ből olvasnak; a Calculator worker fetch-határa is a
saját mappájára szűkült. A manifestek hálózati újraellenőrzést kapnak.
Nincs globális cache-törlés, SW-eltávolítás, localStorage.clear vagy
IndexedDB-törlés. A korábbi cache-ek is megmaradnak. A Chess SW-regisztráció
HTTP cache megkerülésével ellenőrzi a worker frissítését.

A sakklogika, Arena, profilok, kreditek, Program ID-k és mentési kulcsok
változatlanok. A 9062 program HTML/JS fájljait nem módosítja a javítás.

## Automatizált ellenőrzés

- `npm test`: a meglévő 50 egységteszt.
- `npm run test:browser`: a meglévő 113 Playwright böngészőteszt.
- `python tests/pwa/check-config.py`: mindkét checkout alapján 22 manifest
  egyedi ID/start URL, egymást nem fedő scope, PNG méret és ikonellenőrzés.
- `python tests/pwa/server.py`, majd `xvfb-run -a python tests/pwa/browser.py`:
  ugyanazon localhost originen `/chess/` és `/9062/` útvonalak; natív desktop
  Chrome CDP PWA.install/PWA.launch teszt az összes 9 Unicode, 10 Calculator
  és Chess alkalmazással. Az utolsó telepítés után mindet újraindítja és az
  induló URL-t ellenőrzi. Offline navigáció, valódi WASM UCI/legális lépések,
  IndexedDB-profil/kreditegyenleg megőrzése, valamint Desktop/Tablet nézet
  360×800, 412×915, 768×1024 és 1024×768 méretben.

A két checkout legyen testvérmappában, vagy a `PWA_9062_ROOT` adja meg a
9062 checkout helyét. `PWA_BROWSER_PATH` felülírja a Google Chrome binárist.
A GitHub Actions `PWA and regression tests` munkafolyamat mindkét tesztágat
futtatja; a böngészős eredmény JSON artifactban is megmarad.

Helyben ellenőrizve: 50/50 Chess egységteszt; 22 Calculator algoritmuscsoport
és 11 második verziós matematikai tesztcsoport; 22/22 manifest konfiguráció.
A helyi böngészőfuttatást a sandbox `listen EPERM` hibája blokkolta, a WASM
letöltését a nem elérhető hálózati proxy. Ezek nem sikeres böngészőtesztek.
A CI tényleges eredményét a kapcsolódó Actions futás mutatja.

## Android elfogadási próba — még nem igazolt

Valódi Android Chrome-on külön telepítendő például Unicode 7.1, 7.2, 8.1,
9.1, Credit Chess Tablet, majd egy Calculator. Minden ikon a saját programot
indítsa, az összes telepítés maradjon meg egyszerre. Ismételt megnyitás és
repülőgép üzemmód után is ellenőrizendő a programazonosság, a Chess teljes
képernyője, a motor és a korábbi mentések. Más telepítési sorrenddel is
megismétlendő. Desktop Chromium sikere ezt nem helyettesíti.

A készülék korábban telepített alkalmazásainak URL-jei ebben a környezetben
nem olvashatók ki. Nincs böngészőadat-törlésre vagy tömeges eltávolításra
vonatkozó lépés. A korábbi mentések megtartása kötelező.
