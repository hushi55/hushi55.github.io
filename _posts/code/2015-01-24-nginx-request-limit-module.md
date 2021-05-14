---
layout: post
title: req_limit module 源码分析
description: nginx request limit module 源码和算法分析
category: code
tags: [c, nginx, linux]
---
## 结构分析
先来看看各个结构体是怎么样一个组织的：

![](http://7tsy8h.com1.z0.glb.clouddn.com/req_limit 结构示意图.png{{ site.watermark }})

## 涉及到的数据结构

- ngx_rbtree_t：红黑树
- ngx_queue_t：双向队列
- ngx_shm_zone_t：共享内存
- ngx_slab_pool_t：slab 分配器

### 红黑树
红黑树设计到的数据结构和对外的接口方法：

```cgo
//rbtree 节点
typedef struct ngx_rbtree_node_s  ngx_rbtree_node_t;

struct ngx_rbtree_node_s {
    ngx_rbtree_key_t       key;
    ngx_rbtree_node_t     *left;
    ngx_rbtree_node_t     *right;
    ngx_rbtree_node_t     *parent;
    u_char                 color;
    u_char                 data;
};

//想红黑树种插入一个节点
void ngx_rbtree_insert(ngx_rbtree_t *tree, ngx_rbtree_node_t *node);

//删除红黑树种的一个节点
void ngx_rbtree_delete(ngx_rbtree_t *tree, ngx_rbtree_node_t *node);
void ngx_rbtree_insert_value(ngx_rbtree_node_t *root, ngx_rbtree_node_t *node,
    ngx_rbtree_node_t *sentinel);
void ngx_rbtree_insert_timer_value(ngx_rbtree_node_t *root,
    ngx_rbtree_node_t *node, ngx_rbtree_node_t *sentinel);
```

注意红黑树中 ngx_rbtree_node_t 是必须要使用到的节点，所以在使用时一般把它置于结构体的第一个，这样可以做强制类型转换，就可以使用接口函数了。

```cgo
    ...
	//这里是让 ngx_rbtree_node_t->color 和 ngx_http_limit_req_node_t->color 重合
	//ngx_http_limit_req_node_t->data 保存 key 的值
	size = offsetof(ngx_rbtree_node_t, color)
           + offsetof(ngx_http_limit_req_node_t, data)                                                                                
           + key->len;

    ngx_http_limit_req_expire(ctx, 1);

    node = ngx_slab_alloc_locked(ctx->shpool, size);
    ...
```

### 双向队列
双向队列的使用：

```cgo
typedef struct ngx_queue_s  ngx_queue_t;                                                                                              
    
struct ngx_queue_s {
    ngx_queue_t  *prev;
    ngx_queue_t  *next;
};

// 找出中位元素
ngx_queue_t *ngx_queue_middle(ngx_queue_t *queue);

// 排序双向队列，cmp 和 java 的 compare 接口类似
void ngx_queue_sort(ngx_queue_t *queue,                                                                                               
    ngx_int_t (*cmp)(const ngx_queue_t *, const ngx_queue_t *));
```

使用的事只需要结构体中包含 ngx_queue_t 即可。

### 共享内存和分配器的使用
共享内存的使用，第一步先向系统申请：

```cgo
	... ...
 		/**
         * 分配 shared memory
         */
    shm_zone = ngx_shared_memory_add(cf, &name, size,
                                     &ngx_http_limit_req_module);
    if (shm_zone == NULL) {
        return NGX_CONF_ERROR;
    }

    if (shm_zone->data) {
        ctx = shm_zone->data;

        ngx_conf_log_error(NGX_LOG_EMERG, cf, 0,
                           "%V \"%V\" is already bound to key \"%V\"",
                           &cmd->name, &name, &ctx->key.value);
        return NGX_CONF_ERROR;
    }

	//挂载初始化函数
    shm_zone->init = ngx_http_limit_req_init_zone;
    shm_zone->data = ctx;
```

在初始化函数中：

```cgo
	... ...
	// 这里直接将共享内存的首地址赋值给 ngx_slab_pool_t，
	ctx->shpool = (ngx_slab_pool_t *) shm_zone->shm.addr;

    if (shm_zone->shm.exists) {
        ctx->sh = ctx->shpool->data;

        return NGX_OK;                                                                                                                
    }
    ... ... 
```

分配器的接口：

```cgo
void ngx_slab_init(ngx_slab_pool_t *pool);
void *ngx_slab_alloc(ngx_slab_pool_t *pool, size_t size);
void *ngx_slab_alloc_locked(ngx_slab_pool_t *pool, size_t size);
void *ngx_slab_calloc(ngx_slab_pool_t *pool, size_t size);
void *ngx_slab_calloc_locked(ngx_slab_pool_t *pool, size_t size);
void ngx_slab_free(ngx_slab_pool_t *pool, void *p);
void ngx_slab_free_locked(ngx_slab_pool_t *pool, void *p);
```

## 算法分析


[-10]:    http://hushi55.github.io/  "-10"
