# EditForge local tools

The host-side service behind the `kokoro-local` and `hyperframes-local`
providers. It runs on the VPS under systemd, outside Docker, and the web
container reaches it at `EDITFORGE_LOCAL_TOOLS_URL` over the external
`editforge_local_tools` network.

These two files were recovered on 2026-09-23 from the newest install payload
in `/root/editforge-hyperframes-upgrade` on srv1936199. They had never been in
git. The installed copy lives at `/opt/editforge-local-tools` and may have been
edited after that payload; that is unverified.

One disagreement to settle on the host before trusting either number: this unit
file binds `172.16.2.1:3410`, while the web container on 2026-09-23 was
configured to call `http://172.16.8.1:3410`. Read the running unit with
`systemctl cat editforge-local-tools` and the listening address with
`ss -ltnp | grep 3410`.
