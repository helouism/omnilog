# How to View and Manage Docker Container Logs

When something breaks inside a container, the logs are your first and best window into what happened. But Docker's logging model is different from the `/var/log` files you may be used to — output goes to a driver, not a file you can `tail` by default. Knowing how `docker logs` works, where the data actually lives, and how to stop it eating your disk is core operational knowledge for anyone running containers.

## How Docker Logging Works

By default, Docker captures whatever a container writes to **stdout** and **stderr** and hands it to a *logging driver*. The default driver is `json-file`, which writes each line as a JSON object to a file on the host. This is why the golden rule of container logging is:

> **Log to stdout/stderr, not to a file inside the container.**

A process that writes to its own log file inside the container is invisible to `docker logs`, and that data vanishes when the container is removed. Write to stdout and Docker handles the rest.

## The docker logs Command

View all logs for a container:

```bash
docker logs my-container
```

Follow live output, like `tail -f`:

```bash
docker logs -f my-container
```

Show only the last N lines (essential — without this you dump the entire history):

```bash
docker logs --tail 100 my-container
docker logs --tail 100 -f my-container    # last 100, then follow
```

Filter by time:

```bash
docker logs --since 1h my-container
docker logs --since 2024-03-14T09:00:00 my-container
docker logs --until 2024-03-14T10:00:00 my-container
```

Add timestamps (the captured lines do not include them unless your app does):

```bash
docker logs -t my-container
```

## Compose, Kubernetes, and Multiple Containers

With Docker Compose, address services by name and aggregate across replicas:

```bash
docker compose logs -f web              # follow one service
docker compose logs -f --tail 50        # all services, last 50 lines each
docker compose logs web db              # two specific services
```

On Kubernetes the equivalent is `kubectl logs`:

```bash
kubectl logs -f my-pod
kubectl logs --tail 100 my-pod -c my-container   # a specific container in the pod
kubectl logs --previous my-pod                   # logs from the last crashed instance
```

`kubectl logs --previous` is the one to remember — it retrieves the logs of a container that already crashed and restarted, which is exactly when you most need them.

## Where the Logs Actually Live

With the default `json-file` driver, the raw logs sit on the host:

```
/var/lib/docker/containers/<container-id>/<container-id>-json.log
```

Find the full path for a running container:

```bash
docker inspect --format='{{.LogPath}}' my-container
```

Each line in that file is a JSON object like:

```json
{"log":"Server started on port 3000\n","stream":"stdout","time":"2024-03-14T09:00:01.123Z"}
```

You can read it directly, which is handy when you want to grep across it or export it for analysis.

## The Disk-Filling Trap

This is the issue that bites everyone eventually. By default, `json-file` logs have **no size limit**. A chatty container can write tens of gigabytes and fill the host disk, taking down every container on the machine.

Cap log size and rotation per container:

```bash
docker run \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  my-image
```

This keeps at most three files of 10 MB each (30 MB total) and rotates automatically. Set it globally for all containers in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart Docker after editing (`systemctl restart docker`). **Set this before you need it** — it does not apply retroactively to already-running containers.

## Logging Drivers Beyond json-file

`json-file` is the default, but Docker supports others depending on where you want logs to go:

| Driver | Use case |
|---|---|
| `json-file` | Default; local files, works with `docker logs` |
| `local` | Like json-file but more efficient, with built-in rotation |
| `journald` | Send to the systemd journal (`journalctl CONTAINER_NAME=...`) |
| `syslog` | Forward to a syslog server |
| `none` | Disable logging entirely |

Note that with `syslog` or other remote drivers, `docker logs` may no longer work — the data went elsewhere.

## Exporting Logs for Analysis

To pull a container's logs into a flat file for searching or archiving:

```bash
# Capture both stdout and stderr to a file
docker logs my-container > container.log 2>&1

# A specific window
docker logs --since 2024-03-14T09:00:00 --until 2024-03-14T10:00:00 my-container > incident.log 2>&1
```

## Making Sense of the Exported File

Once you have a captured log file — especially from a container that emits structured request logs or syslog-style lines — reading thousands of lines in a pager is slow going. [OmniLog](/) parses exported container logs in the browser: drop the file in and it auto-detects common formats, charts message volume over time so a crash or error burst is immediately visible, and lets you filter by text, severity, or time window to isolate the moment things went wrong. Everything runs client-side, so even logs containing internal data never leave your machine.
