Continent Data Generator for Worlds FRVR
========================================

**Links**
* Make Maps: [worlds-continent-gen](http://jimbly.github.io/worlds-continent-gen/index.html)
* Explore in [Worlds FRVR](https://worlds.frvr.com/)

To view the map you made, open Worlds FRVR, accept the mod permissions dialog, log in and create a new worlds, and chose
the "Procedural" world type.  If you click Export in the map maker, you should now see
the phrase `Continent data provided by mod` in Worlds FRVR.

*Note: The Worlds Mod API currently works only in Firefox and Chrome.*

This demo is built on the [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Making your own continent generator mod
=======================================

```html
  <script src="https://worlds.frvr.com/modapi/worlds_mod_api.bundle.js"></script>
```
```javascript
  let mapi = window.worldsModAPI();
  mapi.on('connect', () => {
    mapi.continentDataSet({
      sea_level: 8192,
      max_elevation: 24576,
      elev: new Uint16Array(256*256),
      humidity: new Uint8Array(256*256),
      river: new Uint8Array(256*256),
      water_level: new Uint16Array(256*256),
      classif: new Uint8Array(256*256),
    });
  });

```
