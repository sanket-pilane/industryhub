# Sample files for trying INDUSTRIHUB

Use these files to try the upload features by hand. Dates must be in the future.

## drawings/: Upload Drawing (signed in as the customer)

| File                        | Part name          | Qty | Material             | Tolerance           | Process                 | Finish        |
| --------------------------- | ------------------ | --- | -------------------- | ------------------- | ----------------------- | ------------- |
| `Gear_Housing_GH-220.pdf`   | Gear Housing       | 250 | Aluminium 6061       | ISO 2768-m (medium) | CNC milling             | Anodised      |
| `Flange_Coupling_FC-90.pdf` | Flange Coupling    | 100 | EN8 Steel            | ISO 2768-f (fine)   | CNC turning             | Zinc plated   |
| `Mounting_Bracket_MB-7.pdf` | Mounting Bracket   | 500 | Mild Steel (IS 2062) | ISO 2768-m (medium) | Sheet metal fabrication | Powder coated |
| `Base_Plate_BP-12.dxf`      | Base Plate         | 60  | Mild Steel (IS 2062) | ±0.1 mm             | Laser cutting           | Painted       |
| `Drive_Shaft_DS-41.step`    | Drive Shaft DS-41  | 120 | Stainless Steel 304  | ±0.05 mm            | CNC turning             | Polished      |

Uploading the same file twice shows a duplicate warning, with an option to upload it anyway.

## qc-documents/: QC upload (signed in as the supplier, job in production)

| File                         | What it is                                   |
| ---------------------------- | -------------------------------------------- |
| `QC_Report_GH-220.pdf`       | Dimensional inspection report for the gear housing |
| `QC_Photo_GH-220.png` / `.jpg` | Inspection photo with a measurement callout |
| `QC_Measurements_GH-220.csv` | Measurements for 25 samples                  |

## invalid/: files the app must refuse

| File                   | Where to try it | Expected result                                                |
| ---------------------- | --------------- | -------------------------------------------------------------- |
| `photo_of_drawing.png` | Upload Drawing  | Refused: PNG is not a drawing format                           |
| `fake_drawing.pdf`     | Upload Drawing  | Refused: named .pdf but the content is a Windows program header |
