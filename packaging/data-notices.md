# Sample building data

The packaged editor includes four small building assets and their textures in
`editor/data/assets/hamburg-lod3/`. They are extracted from Hamburg's published
LoD3.0-HH Area 1 data (2023, tile 6433).

Source attribution: **Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation
und Vermessung (LGV)**. Data license: [Datenlizenz Deutschland – Namensnennung –
Version 2.0](https://www.govdata.de/dl-de/by-2-0).

[Hamburg dataset](https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg17).
The CityJSON objects also retain the original source object IDs, source URL and
attribution. Editor processing extracts each building with its descendants,
normalizes it for placement, adjusts texture references and creates previews.
These are adapted data assets; the editor's Apache-2.0 code license does not
replace their data license.

The full Hamburg road/building catalogs and satellite imagery are not included
in the npm package. Online basemaps, imagery, trees, optional sample downloads and
remote catalogs have their own service and data terms. Keep their displayed
attribution. The TU Delft/3DBAG sample links download data only when chosen;
[3DBAG attribution requirements](https://docs.3dbag.nl/en/copyright/) apply to
redistribution of those downloads.
