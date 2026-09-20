# Needs validation
Source-grounded items whose decisive fact lies outside the repository. These carry **no severity** — they are blocked questions, not low-confidence findings.

## What the SSRF bypass can actually reach on the Canner deploy host is not determinable from source

- **Fingerprint:** `ssrf/place-url/internal-reachability-on-deploy-host`

The guard bypass above is established from source, but its blast radius depends on facts that live in the deployment rather than the repository: whether the host has an IPv6 stack that routes ::ffff:7f00:1 to the IPv4 loopback, and whether any https service - an admin endpoint, a sidecar, a metrics or metadata service behind TLS - listens on loopback or the private network reachable from the app process. The audit container has no IPv6 stack, so the connection half of the check could not be run here.

**Claimed root cause:** Same root cause as ssrf/place-url/hostname-string-guard-bypass: the fetch guard decides on the hostname string rather than the resolved address.

### Blockers

- The audit container returned EAFNOSUPPORT for every IPv6 connection, so whether ::ffff:7f00:1 and :: route to the IPv4 loopback on the deploy host could not be observed.
- The set of services listening on the deploy host's loopback and private network is not present in the repository.
- Whether the hosting platform exposes an https metadata or control endpoint reachable from the app process is a provider fact, not a source fact.

### How to settle it

**Locally:** On a machine with IPv6 enabled, start a throwaway TLS listener on 127.0.0.1, then call the exported isPublicHttpsUrl with https://[::ffff:7f00:1]:<port>/ and issue the same fetch the module makes. Confirming that the guard returns true and the connection lands on the local listener closes the routing question without touching any deployed system.

**On the deployment:** From inside the running Canner instance, and with the owner's agreement, enumerate listening sockets (ss -ltnp) and note any bound to loopback or a private interface that speak TLS. This is an owner-side observation on their own host - it does not require sending the app a crafted link, and no third-party or shared infrastructure should be probed.

Neither step probes a third party or shared infrastructure.

