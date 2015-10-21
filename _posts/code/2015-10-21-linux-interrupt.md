---
layout: post
title: linux interrupt
description: linux interrupt 介绍
category: code
tags: [linux, kernel, interrupt]
---
## 中断在内存在的数据视图
linux interrupt 在 linux 有两个比较重要的数据视图

- /proc/interrupts 文件 
- /proc/irq/ 子目录

我们先来看看 /proc/interrupts 这个视图是怎么样的：

<pre class="nowordwrap">
[root@docker221 ~]# cat /proc/interrupts 
            CPU0       CPU1       CPU2       CPU3       CPU4       CPU5       CPU6       CPU7       
   0:        101          0          0          0          0          0          0          0   IO-APIC-edge      timer
   1:         10          0          0        565          0          0          0          0  xen-pirq-ioapic-edge  i8042
   6:          3          0          0          0          0          0          0          0  xen-pirq-ioapic-edge  floppy
   7:          0          0          0          0          0          0          0          0  xen-pirq-ioapic-edge  parport0
   8:          2          0          0          0          0          0          0          0  xen-pirq-ioapic-edge  rtc0
   9:          0          0          0          0          0          0          0          0   IO-APIC-fasteoi   acpi
  12:        145          0          0          0          0          0          0        669  xen-pirq-ioapic-edge  i8042
  14:          0          0          0          0          0          0          0          0   IO-APIC-edge      ata_piix
  15:      92130     263609     247456     196365     248794     114265     192813   17237957   IO-APIC-edge      ata_piix
  23:         23          0          0          0          0          0          0         13  xen-pirq-ioapic-level  uhci_hcd:usb1
  64: 2844203322          0          0          0          0          0          0          0  xen-percpu-virq      timer0
  65: 4011288744          0          0          0          0          0          0          0  xen-percpu-ipi       resched0
  66:  149448119          0          0          0          0          0          0          0  xen-percpu-ipi       callfunc0
  67:          0          0          0          0          0          0          0          0  xen-percpu-virq      debug0
  68:   96677001          0          0          0          0          0          0          0  xen-percpu-ipi       callfuncsingle0
  69:    3927847          0          0          0          0          0          0          0  xen-percpu-ipi       spinlock0
  70:          0 2005575034          0          0          0          0          0          0  xen-percpu-virq      timer1
  71:          0 1703505472          0          0          0          0          0          0  xen-percpu-ipi       resched1
  72:          0  151484784          0          0          0          0          0          0  xen-percpu-ipi       callfunc1
  73:          0          0          0          0          0          0          0          0  xen-percpu-virq      debug1
  74:          0  106750775          0          0          0          0          0          0  xen-percpu-ipi       callfuncsingle1
  75:          0    3944086          0          0          0          0          0          0  xen-percpu-ipi       spinlock1
  76:          0          0 2341712910          0          0          0          0          0  xen-percpu-virq      timer2
  77:          0          0 1450048536          0          0          0          0          0  xen-percpu-ipi       resched2
  78:          0          0  128936788          0          0          0          0          0  xen-percpu-ipi       callfunc2
  79:          0          0          0          0          0          0          0          0  xen-percpu-virq      debug2
  80:          0          0   84814469          0          0          0          0          0  xen-percpu-ipi       callfuncsingle2
  81:          0          0    3601868          0          0          0          0          0  xen-percpu-ipi       spinlock2
  82:          0          0          0 2267335285          0          0          0          0  xen-percpu-virq      timer3
  83:          0          0          0  600257105          0          0          0          0  xen-percpu-ipi       resched3
  84:          0          0          0  133243573          0          0          0          0  xen-percpu-ipi       callfunc3
  85:          0          0          0          0          0          0          0          0  xen-percpu-virq      debug3
  86:          0          0          0   81093166          0          0          0          0  xen-percpu-ipi       callfuncsingle3
  87:          0          0          0    3502054          0          0          0          0  xen-percpu-ipi       spinlock3
  88:          0          0          0          0 2115301138          0          0          0  xen-percpu-virq      timer4
  89:          0          0          0          0  728657869          0          0          0  xen-percpu-ipi       resched4
  90:          0          0          0          0  132279720          0          0          0  xen-percpu-ipi       callfunc4
  91:          0          0          0          0          0          0          0          0  xen-percpu-virq      debug4
  92:          0          0          0          0   81400733          0          0          0  xen-percpu-ipi       callfuncsingle4
  93:          0          0          0          0    3427391          0          0          0  xen-percpu-ipi       spinlock4
  94:          0          0          0          0          0 2145376645          0          0  xen-percpu-virq      timer5
  95:          0          0          0          0          0  236524947          0          0  xen-percpu-ipi       resched5
  96:          0          0          0          0          0  132211572          0          0  xen-percpu-ipi       callfunc5
  97:          0          0          0          0          0          0          0          0  xen-percpu-virq      debug5
  98:          0          0          0          0          0   81880824          0          0  xen-percpu-ipi       callfuncsingle5
  99:          0          0          0          0          0    3590193          0          0  xen-percpu-ipi       spinlock5
 100:          0          0          0          0          0          0 2126495446          0  xen-percpu-virq      timer6
 101:          0          0          0          0          0          0 4269631923          0  xen-percpu-ipi       resched6
 102:          0          0          0          0          0          0  134202455          0  xen-percpu-ipi       callfunc6
 103:          0          0          0          0          0          0          0          0  xen-percpu-virq      debug6
 104:          0          0          0          0          0          0   81670546          0  xen-percpu-ipi       callfuncsingle6
 105:          0          0          0          0          0          0    3628607          0  xen-percpu-ipi       spinlock6
 106:          0          0          0          0          0          0          0 1584236686  xen-percpu-virq      timer7
 107:          0          0          0          0          0          0          0 2211547569  xen-percpu-ipi       resched7
 108:          0          0          0          0          0          0          0  131658570  xen-percpu-ipi       callfunc7
 109:          0          0          0          0          0          0          0          0  xen-percpu-virq      debug7
 110:          0          0          0          0          0          0          0   79512648  xen-percpu-ipi       callfuncsingle7
 111:          0          0          0          0          0          0          0    3875555  xen-percpu-ipi       spinlock7
 112:        347          0          0          0          0          0          4          0   xen-dyn-event     xenbus
 113:       8536          0          0          0          0          0          0  516134858   xen-dyn-event     blkif
 114:  749775929          0          0          0          0          0          0          0   xen-dyn-event     eth0
 NMI:          0          0          0          0          0          0          0          0   Non-maskable interrupts
 LOC:          0          0          0          0          0          0          0          0   Local timer interrupts
 SPU:          0          0          0          0          0          0          0          0   Spurious interrupts
 PMI:          0          0          0          0          0          0          0          0   Performance monitoring interrupts
 IWI:   77770231   59439640   41287756   39469408   41371499   41275040   40654227   41210691   IRQ work interrupts
 RTR:          0          0          0          0          0          0          0          0   APIC ICR read retries
 RES: 4011288745 1703505472 1450048536  600257105  728657869  236524947 4269631923 2211547569   Rescheduling interrupts
 CAL: 4286015824 4285752264 4287125822 4287268137 4286953722 4287128322 4287081469 4286621008   Function call interrupts
 TLB:  255076592  267450591  221592731  222035898  221694027  221931370  223758828  219517506   TLB shootdowns
 TRM:          0          0          0          0          0          0          0          0   Thermal event interrupts
 THR:          0          0          0          0          0          0          0          0   Threshold APIC interrupts
 MCE:          0          0          0          0          0          0          0          0   Machine check exceptions
 MCP:      42321      42321      42321      42321      42321      42321      42321      42321   Machine check polls
 ERR:          0
 MIS:          0
[root@docker221 ~]#
</pre>

其中每列依次为：irq 的编号，irq 中 cup 上的累积处理次数，中断控制器的名字，irq的名字，以及驱动程序注册该irq时使用的名字。

其中 /proc/irq 的每个子目录对应的是一个 interrupt 编号。

<pre>
[root@docker221 114]# pwd
/proc/irq/114
[root@docker221 114]# ls
affinity_hint  eth0  node  smp_affinity  smp_affinity_list  spurious
</pre>

其中比较常用的文件的作用：

- smp_affinity：irq和cpu之间的亲缘绑定关系
- affinity_hint：只读条目，用于用户空间做irq平衡只用
- spurious：可以获得该irq被处理和未被处理的次数的统计信息

## 参考

- http://blog.csdn.net/droidphone/article/details/7445825
- https://www.ibm.com/developerworks/cn/linux/l-cn-linuxkernelint/

[-10]:    http://hushi55.github.io/  "-10"
