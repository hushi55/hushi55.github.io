---
layout: post
title: Golang Netlink 
description: Golang Netlink 
category: code
tags: [linux, Golang, netlink]
---

## golang netlink 的分类

### link 对象

### linux 中命令可以使用 netlink 代替

<pre class="nowordwrap">
Failed to watch directory "/sys/fs/cgroup/memory/system.slice": inotify_add_watch /sys/fs/cgroup/memory/system.slice/run-docker-netns-c6d57b04b0f8.mount: no space left on device
</pre>

<pre class="nowordwrap">
sudo find /proc/*/fd -lname anon_inode:inotify |
   cut -d/ -f3 |
   xargs -I '{}' -- ps --no-headers -o '%p %U %c' -p '{}' |
   uniq -c |
   sort -nr
</pre>

<pre class="nowordwrap">
sysctl -w fs.inotify.max_user_watches=81920
</pre>

从上面可以知道可以互相代替的命令分为了 3 打类

- ip
    address - protocol (IP or IPv6) address on a device.
    addrlabel  - label configuration for protocol address selection.
    l2tp   - tunnel ethernet over IP (L2TPv3).
    link   - network device.
    maddress - multicast address.
    monitor - watch for netlink messages.
    mroute - multicast routing cache entry.
    mrule  - rule in multicast routing policy database.
    neighbour - manage ARP or NDISC cache entries.
    netns  - manage network namespaces.
    ntable - manage the neighbor cache's operation.
    route  - routing table entry.
    rule   - rule in routing policy database.
    cp_metrics/tcpmetrics - manage TCP Metrics
    token  - manage tokenized interface identifiers.
    tunnel - tunnel over IP.
    tuntap - manage TUN/TAP devices.
    xfrm   - manage IPSec policies.
- bridge
- tc

[-10]:   	 http://hushi55.github.io/  "-10"