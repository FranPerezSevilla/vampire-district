# Skyline architecture and traversal
Goal: replace rooftop ornaments with credible flat roof structures and a connected high-rise route north of the refuge.
Authority: city compiler skyline pass, existing roofAreas/rooftopRoutes/roofDrops and TransitionSystem.
Scope: three composite L-plan towers, setbacks, high-roof service stairs, tower-to-tower jumps and courtyard drops. Input remains Space at a contextual access point.
Non-goals: a 3D camera, continuous floor simulation, changes to traffic or street layout.
Acceptance: solid building wings match collision rectangles; recessed courts remain open; access and jump endpoints are inside their layer; city regeneration is deterministic; high drops use the existing transition owner.
Validation: compiler validation, skyline geometry regression tests, packaged browser traversal.

## Camera parallax
Street view projects cached roof graphics away from the camera centre and joins them to the unchanged base with shaded windowed facade planes. Taller buildings have greater bounded displacement; the wings of each L-plan tower share a projection anchor. Rendering is restricted to visible resident buildings; graphics are released when culled and on scene shutdown. Roof layers disable this street projection to preserve clear traversal/landing alignment.

Boot guard: the title preview keeps static building geometry. Parallax starts only after New Night; unchanged camera/visible building state reuses the existing facade graphics.

Height iteration: ordinary roofs now use 46 world units, landmarks 78 and skyline towers 80 + storeys × 3. Projection is centred on Phaser's unzoomed camera centre (scroll + viewport / 2), with a 320-unit culling margin. Regression checks cover camera panning at non-unit zoom and shared L-wing alignment.

Street occlusion: each visible building has a separate facade graphic and roof graphic ordered by footprint foreground edge above street actors. Only outward-facing facade planes are drawn, lateral plane first and horizontal front last. A shared geometry mask clips a pale player silhouette to the projected roof/facade union; it is hidden on rooftop/sewer layers. Collision footprints are unchanged.

Roof/facade join: the runtime roof pass now paints an opaque cover up to the exact collision footprint and requests a rectangular roof recipe for each rectangular solid. Ground foundation, yard and frontage modules are excluded from the elevated roof pass. Composite L towers retain their two real collision wings; shared facade segments are subtracted so only the exterior envelope is drawn.
