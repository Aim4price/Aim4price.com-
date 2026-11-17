# Custom advert designs

In Advert Studio, open **Advert Template → Layout → Create your own**. Start blank or choose **Starter layout**, then move and resize elements. Choose **Use design**, complete the template steps and save. The saved template is available in Create Advert and fills its asset fields and photo slots from each selected advert.

Supported elements: custom text, asset title/price/year/usage/condition, contact fields, four asset photo slots, embedded uploaded artwork, company logo, rectangles and circles. The editor supports crop position, image fitting, fonts, colours, alignment, layer ordering, duplication, keyboard nudging, and undo/redo. Sizes are landscape (1600×900), square (1080×1080) and portrait (1080×1350).

The design is a versioned JSON document on the existing account-scoped brand kit and is copied into published advert snapshots. Existing templates continue using their original renderer. An additive `custom_design` column is created by the existing schema guard; a matching SQL migration is included. No new service or package is needed.

Preview and export use the same canvas renderer. Dynamic text reduces to fit its frame; exceptionally long wording is clipped with an ellipsis at the minimum font size. Preview photo placeholders are intentional; real advert exports reject missing required photos or logos. Templates support 40 elements and a combined 2 MB of embedded artwork. Uploads accept PNG, JPEG and WebP up to 10 MB and are resized before being saved. Photo slots are preferable for images that change between adverts.

Validation: `npm run test:ad-studio` and `npm run typecheck`. The custom-design tests cover JSON snapshots, input limits, canvas dimensions, dynamic fields, required photos, and create/update/reload/account isolation against PGlite. The browser smoke check exercises pointer dragging, resizing, keyboard nudging, undo/redo, PNG/preview pixel equality, template saving/reopening and the phone viewport with mocked account APIs; no production customer records are used.
