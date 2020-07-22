Continent Data Generator for Worlds FRVR
========================================

**Links**
* Make Maps: [worlds-continent-gen](http://jimbly.github.io/worlds-continent-gen/)
* Explore in [Worlds FRVR](https://worlds.frvr.com/)

To view the map you made, open Worlds FRVR (over ***https only***), accept the mod permissions dialog, log in and create a new world, and choose
the "Procedural" world type.  If you click Export in the map maker, you should now see
the phrase `Continent data provided by mod` in Worlds FRVR under the World Type selection.

Notes:
* The *Worlds Mod API* currently works only in Firefox and Chrome, so you can only preview your map in Worlds on those browsers
* There are plenty of ways to generate very poor maps that may crash the Worlds client upon anyone trying to visit your world.  If your map crashes in Worlds, just delete your world and try again =).

This demo is built on the [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Making your own continent generator mod
=======================================

```html
  <script src="//worlds.frvr.com/modapi/worlds_mod_api.bundle.js"></script>
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

All continent data arrays represent a 256x256 array stored in row-major format. Note that each entry in our continent data describes a hexagonal region, using an "if x is odd, shift up" encoding, so array entry index (x + y * 256) describes the hex (x,y) which maps to the cartesian coordinates of (x * √(3/4), y + ((x is odd) ? 0.5 : 0).

License
=======
GLOV.js and the Worlds Mod API are distributed under the MIT License.

Other code in this repo is provided for example purposes only, and no license is granted at this time.
