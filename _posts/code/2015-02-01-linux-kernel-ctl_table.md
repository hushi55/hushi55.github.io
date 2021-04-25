---
layout: post
title: linux kernel 系列 - ctl_table
description: linux kernel ctl_table 解释
category: code
tags: [c, linux, kernel]
---
在看 epoll 的 linux 源码时，对于 ctl_table 不是很清楚，就查了一下关于这个的解释。这个主要是用于 linux /proc 和用户空间通信的一种虚拟文件系统中。

```cgo
/* A sysctl table is an array of struct ctl_table: */
struct ctl_table 
{
		 /* 数值表示的该项的ID */  
        int ctl_name;                   /* Binary ID */
        /* 名称 */  
        const char *procname;           /* Text ID for /proc/sys, or zero */
        /* 对于的内核参数 */  
        void *data;
        /* 该参数所占的存储空间 */  
        int maxlen;
        /* 权限模式：rwxrwxrwx */  
        mode_t mode;
        /* 子目录表 */  
        struct ctl_table *child;
        struct ctl_table *parent;       /* Automatically set */
        /* 读写数据处理的回调函数 */  
        proc_handler *proc_handler;     /* Callback for text formatting */
        
        /* 
         *	读/写时的回调函数,是对数据的预处理， 
     	 *	该函数是在读或写操作之前执行，该函数返回值 
     	 *	<0表示出错；==0表示正确，继续读或写；>0表 
    	 *	 示读/写操作已经在函数中完成，可以直接返回了
     	 */  
        ctl_handler *strategy;          /* Callback function for all r/w */
        
        /* 额外参数，常在设置数据范围时用来表示最大最小值 */  
        void *extra1;
        void *extra2;
};
```

注意该结构中的第6个参数子目录表，这使得该表成为树型结构。第二个参数表示链表的插入方式，是插入到链表头还是链表尾。由此可知重要的是struct ctl_table结构的填写，而最重要的是结构项proc_handler，该函数处理数据的输入和输出，如果不是目录而是文件，该项是不可或缺的。早期内核版本中这些都需要单独编写，现在2.4以后内核提供了一些函数可以完成大部分的数据输入输出功能：  

```cgo
// 处理字符串数据  
extern int proc_dostring(struct ctl_table *, int,
                         void __user *, size_t *, loff_t *);
// 处理整数向量  
extern int proc_dointvec(struct ctl_table *, int,
                         void __user *, size_t *, loff_t *);
// 处理最大最小值形式的整数向量
extern int proc_dointvec_minmax(struct ctl_table *, int,                                                                              
                                void __user *, size_t *, loff_t *);
// 处理整数向量,但用户数据作为秒数,转化为jiffies值,常用于时间控制  
extern int proc_dointvec_jiffies(struct ctl_table *, int,
                                 void __user *, size_t *, loff_t *);
extern int proc_dointvec_userhz_jiffies(struct ctl_table *, int,
                                        void __user *, size_t *, loff_t *);
extern int proc_dointvec_ms_jiffies(struct ctl_table *, int,
                                    void __user *, size_t *, loff_t *);
// 处理最大最小值形式的无符合长整数向量  
extern int proc_doulongvec_minmax(struct ctl_table *, int,
                                  void __user *, size_t *, loff_t *);
// 处理无符合长整数向量,用户数据作为为毫秒值,转化为jiffies值,常用于时间控制
extern int proc_doulongvec_ms_jiffies_minmax(struct ctl_table *table, int,
                                      void __user *, size_t *, loff_t *);
extern int proc_do_large_bitmap(struct ctl_table *, int,
                                void __user *, size_t *, loff_t *);
```

## 参考

- [http://cxw06023273.iteye.com/blog/867298](http://cxw06023273.iteye.com/blog/867298)


[-10]:    http://hushi55.github.io/  "-10"
