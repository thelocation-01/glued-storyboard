# Privacy

Glued Storyboard is local-first software. It does not require an account or an OpenAI API key.

- Scripts and project metadata are stored under `data/`.
- Imported images and generated narration are stored under `public/offline-media/`.
- Rendered MP4 files are stored under `renders/`.
- The setup process connects to package registries and the upstream Kokoro release to install dependencies and model files.
- The application itself does not upload projects to Glued, The Brantheath, Whop, GitHub, OpenAI, or another hosted service.

If you use an external AI image generator, music service, cloud backup, or publishing platform, its own privacy terms apply. Remove sensitive information from scripts and metadata before sharing a project ZIP.

