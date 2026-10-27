# VS Code application roots

## Ownership

`VSCodeApp` composes the shared runtime, theme and sync contexts for VS Code webviews. The extension host selects the root's `panelType` in its bootstrap document. `VSCodeLayout` owns chat/session navigation; `SettingsView` owns Settings pages and responsive navigation. The native panel lifecycle belongs to `packages/vscode/src`, documented there.

## Invariants

- Chat-side Settings entry points request the native Settings tab through `RuntimeAPIs.vscode`. They preserve chat selection, drafts and the current layout. The source's in-page dialog flag is cleared so it cannot block chat shortcuts.
- Only the Settings root receives page navigation. The bridge parses it before applying it to stores, and the mounted root signals readiness before the host consumes pending navigation.
- The Settings root supplies no selected directory to the shared sync provider. It does not start global session polling, selected-directory session bootstrap or background queue delivery/cleanup, and seeing it never marks a chat as viewed. Settings pages resolve their own project through `useSettingsDirectory`; catalog updates still use the shared sync context.
- Its runtime shortcut hook registers Settings actions only and requires no chat sync context. Chat, model and session shortcuts remain with chat roots, so a key pressed in Settings cannot create an unseen draft or change a session selection there. Escape reaches an input or menu before the tab's close handler.
- Settings uses the existing persistence and broadcast protocol. Moving its host changes no stored format, registry key or runtime availability.
- The VS Code chat root's sessions sidebar reads and writes the shared `useUIStore` sidebar state (`isSidebarOpen`, `sidebarWidth`); the layout keeps no collapse flag or width of its own, so the choice persists like the desktop sidebar's.

## Decisions

### Why navigation carries intent and not the source's stores

Each webview owns its own stores. A small parsed request preserves the originating Settings directory, page links, provider-connect action and new-snippet action without transferring chat state or overwriting the tab's independently edited settings.

### Why the VS Code sessions sidebar shares the app's sidebar state

The expanded VS Code layout reads `useUIStore.isSidebarOpen` and `sidebarWidth`, so collapse and width choices persist through the existing store. VS Code allows resizing down to 196px because its webview has less horizontal space. The desktop layout clamps the shared width to at least 264px when rendering, keeping room for its toolbar.
