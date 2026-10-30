# Design evidence

Source file: https://www.figma.com/design/Tqt0gIyXS1ceEhPZgRLh8U

| Surface                  | Figma node |
| ------------------------ | ---------- |
| Desktop home             | 4:10       |
| Mobile home              | 4:16       |
| Desktop login            | 61:1976    |
| Mobile login             | 61:1981    |
| Catalog visual reference | 4:11       |

Retrieved high-fidelity design contexts and screenshots before implementation. Home motion context returned no keyframes; ordinary color/border interactions use 180ms transitions with reduced-motion overrides.

Static design assets are downloaded to `web/public/figma`; runtime contains no temporary Figma URLs. Original SVGs retain their intrinsic dimensions inside icon slots. Product images use Next Image. Inter is self-hosted from the installed font package, so running/building does not fetch Google Fonts.

The requested Phase 0 home/login closely follow reference layout at 1440px and 390px, with 375px checks. Scaffold destinations use the same tokens; complete account, catalog and other screen fidelity remains Phase 1 work. Catalog currently has functional read-only search/filter/specification disclosure rather than an unfinished add-to-cart control.

Intentional accessibility adaptations: navy text on safety-orange actions, darker green stock text, larger hit targets and readable mobile captions. Manufacturing summary grows naturally instead of clipping its third row. Long titles wrap. Local inventory counts replace unavailable production marketing counts. Demo help/credentials and Phase 0 boundaries are labeled explicitly.

Home, login, catalog and signed-in overview states previously passed scoped accessibility scans; responsive sweeps passed at 375/390/768/1024/1440px. Browser automation, its test files and generated screenshots/reports were subsequently removed at the user's request. Continue visual review manually in localhost. The complete Figma prototype is not yet implemented.
