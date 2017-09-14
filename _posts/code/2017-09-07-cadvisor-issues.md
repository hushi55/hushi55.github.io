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
Equivalent to: `ip addr add $addr dev $link`
Equivalent to: `ip addr del $addr dev $link`
Equivalent to: `ip addr show`.
Equivalent to: `ip addr replace $addr dev $link`
Equivalent to: `bridge vlan add dev DEV vid VID [ pvid ] [ untagged ] [ self ] [ master ]`
Equivalent to: `bridge vlan del dev DEV vid VID [ pvid ] [ untagged ] [ self ] [ master ]`
Equivalent to: `bridge vlan show`
Equivalent to: `tc class add $class`
Equivalent to: `tc class change $class`
Equivalent to: `tc class del $class`
Equivalent to: `tc class show`.
Equivalent to: `tc filter add $filter`
Equivalent to: `tc filter del $filter`
Equivalent to: `tc filter show`.
Equivalent to: `ip link add $link`
Equivalent to: `ip link del $link`
Equivalent to: `ip link show`
Equivalent to: `ip link set dev $link alias $name`
Equivalent to: `ip link set $link down`
Equivalent to: `ip link set $link address $hwaddr`
Equivalent to: `ip link set $link mtu $mtu`
Equivalent to: `ip link set $link master $master`
Equivalent to: `ip link set $link master $master`
Equivalent to: `ip link set $link name $name`
Equivalent to: `ip link set $link nomaster`
Equivalent to: `ip link set $link netns $pid`
Equivalent to: `ip link set $link up`
Equivalent to: `ip link set $link vf $vf mac $hwaddr`
Equivalent to: `ip link set $link vf $vf spoofchk $check`
Equivalent to: `ip link set $link vf $vf trust $state`
Equivalent to: `ip link set $link vf $vf rate $rate`
Equivalent to: `ip link set $link vf $vf vlan $vlan`
Equivalent to: `ip neigh add ....`
Equivalent to: `bridge fdb append...`
Equivalent to: `ip addr del $addr dev $link`
Equivalent to: `ip neighbor show`.
Equivalent to: `ip neighbor show proxy`.
Equivalent to: `ip neigh replace....`
Equivalent to: `tc qdisc add $qdisc`
Equivalent to: `tc qdisc change $qdisc`
Equivalent to: `tc qdisc del $qdisc`
Equivalent to: `tc qdisc show`.
Equivalent to: `tc qdisc replace $qdisc`
Equivalent to: `ip route add $route`
Equivalent to: `ip route del $route`
Equivalent to: &#39;ip route get&#39;.
Equivalent to: `ip route show`.
Equivalent to: `ip route replace $route`
Equivalent to: ip rule add
Equivalent to: ip rule del
Equivalent to: ip rule list
Equivalent to: `ip xfrm policy add $policy`
Equivalent to: `ip xfrm policy del $policy`
Equivalent to: `ip xfrm policy flush`
Equivalent to: `ip xfrm policy show`.
Equivalent to: `ip xfrm policy update $policy`
Equivalent to: `ip xfrm state add $state`
Equivalent to: `ip xfrm state del $state`
Equivalent to: `ip xfrm state flush [ proto XFRM-PROTO ]`
Equivalent to: `ip [-4|-6] xfrm state show`.
Equivalent to: `ip xfrm state update $state`
Equivalent to: `ip addr add $addr dev $link`
Equivalent to: `ip addr del $addr dev $link`
Equivalent to: `ip addr show`.
Equivalent to: `ip addr replace $addr dev $link`
Equivalent to: `bridge vlan add dev DEV vid VID [ pvid ] [ untagged ] [ self ] [ master ]`
Equivalent to: `bridge vlan del dev DEV vid VID [ pvid ] [ untagged ] [ self ] [ master ]`
Equivalent to: `bridge vlan show`
Equivalent to: `tc class add $class`
Equivalent to: `tc class change $class`
Equivalent to: `tc class del $class`
Equivalent to: `tc class show`.
Equivalent to: `tc filter add $filter`
Equivalent to: `tc filter del $filter`
Equivalent to: `tc filter show`.
Equivalent to: `ip link add $link`
Equivalent to: `ip link del $link`
Equivalent to: `ip link show`
Equivalent to: `ip link set dev $link alias $name`
Equivalent to: `ip link set $link down`
Equivalent to: `ip link set $link address $hwaddr`
Equivalent to: `ip link set $link mtu $mtu`
Equivalent to: `ip link set $link master $master`
Equivalent to: `ip link set $link master $master`
Equivalent to: `ip link set $link name $name`
Equivalent to: `ip link set $link nomaster`
Equivalent to: `ip link set $link netns $pid`
Equivalent to: `ip link set $link up`
Equivalent to: `ip link set $link vf $vf mac $hwaddr`
Equivalent to: `ip link set $link vf $vf spoofchk $check`
Equivalent to: `ip link set $link vf $vf trust $state`
Equivalent to: `ip link set $link vf $vf rate $rate`
Equivalent to: `ip link set $link vf $vf vlan $vlan`
Equivalent to: `ip neigh add ....`
Equivalent to: `bridge fdb append...`
Equivalent to: `ip addr del $addr dev $link`
Equivalent to: `ip neighbor show`.
Equivalent to: `ip neighbor show proxy`.
Equivalent to: `ip neigh replace....`
Equivalent to: `tc qdisc add $qdisc`
Equivalent to: `tc qdisc change $qdisc`
Equivalent to: `tc qdisc del $qdisc`
Equivalent to: `tc qdisc show`.
Equivalent to: `tc qdisc replace $qdisc`
Equivalent to: `ip route add $route`
Equivalent to: `ip route del $route`
Equivalent to: &#39;ip route get&#39;.
Equivalent to: `ip route show`.
Equivalent to: `ip route replace $route`
Equivalent to: ip rule add
Equivalent to: ip rule del
Equivalent to: ip rule list
Equivalent to: `ip xfrm policy add $policy`
Equivalent to: `ip xfrm policy del $policy`
Equivalent to: `ip xfrm policy flush`
Equivalent to: `ip xfrm policy get { SELECTOR | index INDEX } dir DIR [ctx CTX ] [ mark MARK [ mask MASK ] ] [ ptype PTYPE ]`.
Equivalent to: `ip xfrm policy show`.
Equivalent to: `ip xfrm policy update $policy`
Equivalent to: `ip xfrm state add $state`
Equivalent to: `ip xfrm state del $state`
Equivalent to: `ip xfrm state flush [ proto XFRM-PROTO ]`
Equivalent to: `ip xfrm state get ID [ mark MARK [ mask MASK ] ]`.
Equivalent to: `ip xfrm state show`.
Equivalent to: `ip xfrm state update $state`
Equivalent to: `ip xfrm policy get { SELECTOR | index INDEX } dir DIR [ctx CTX ] [ mark MARK [ mask MASK ] ] [ ptype PTYPE ]`.
Equivalent to: `ip xfrm state allocspi`
Equivalent to: `ip xfrm state get ID [ mark MARK [ mask MASK ] ]`.
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