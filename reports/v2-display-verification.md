# Version 2 display verification

The standard resolution is 1920 × 1080. The game uses a logical viewport independently of the browser's display size. On a 3840 × 2160 screen, the standard interface scales by two: a 448-pixel menu card occupies 896 physical CSS pixels. Players can choose 720p, 1080p, 1440p, 2160p or native display in Settings. Phones and smaller windows retain responsive layouts rather than shrinking text to fit a fixed desktop canvas.

The three animated circular rings remain behind the marked foreground signs, holograms and sentinel. The signs are brought forward while retaining their apparent placement; the rings retain their animation and remain in front of the distant city towers. Canvas layout measures the logical viewport before the interface scale, preventing oversized or displaced backgrounds at 4K.

## Automated coverage

Five focused display unit tests passed. They cover 4K standard scaling, small and rotated screens, ultrawide aspect preservation, explicit/native resolution selection, and migration of existing or invalid saved preferences.

Four focused display browser cases passed in the complete game regression run. They verify the actual 4K menu-card size, full canvas bounds, ring depth, projected board bounds, a real canvas raycast swap after scaling, 720p persistence through reload, return to native and standard resolution, and small-screen/landscape fallback input. Desktop and emulated mobile both passed. These cases allow 180 seconds for multiple software-WebGL canvas rebuilds at 4K.

After correcting rotation-test synchronization to wait for both HUD width and dock height, all 38 responsive, slot-layout and complete-training rerun cases passed against the final production build in 6.8 minutes. Chromium, Firefox, WebKit and installed Edge passed. The original layout bounds assertions remain in place. See the [complete version 2 report](version-2-verification.md) for the full test matrix and scope.

The screenshots were inspected: the menu and board are centered, all three rings remain visible, and opaque signs cover the rings where they overlap. Transparent holograms retain their glass appearance. Evidence: [4K menu](v2-4k-menu-desktop.png), [4K board after a real swap](v2-4k-board-desktop.png), and [landscape fallback](v2-landscape-mobile.png).

Resolution is a rendering and layout choice; it does not change level rules, saved board positions, scoring or inventories. These checks use browser emulation and software WebGL. They do not establish frame rates on every physical device.
