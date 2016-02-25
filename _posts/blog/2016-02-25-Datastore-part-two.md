---
layout: post
title: Uber's Schemaless Datastore part two 
description: Uber's Schemaless Datastore 架构设计
category: blog
tags: [algorithm, datastore, distributed]
---

In Project Mezzanine: The Great Migration at Uber, 
we described how we migrated Uber’s core trips data from a single Postgres instance to Schemaless, 
our scalable and highly available datastore. Then we gave an overview of Schemaless—its development decision process, 
the overall data model—and introduced features like Schemaless triggers and indexes. 
This article covers Schemaless’s architecture.

## Schemaless Synopsis

To recap, Schemaless is a scalable and fault-tolerant datastore. 
The basic entity of data is called a cell. It is immutable, and once written, 
it cannot be overwritten. (In special cases, we can delete old records.)
A cell is referenced by a row key, column name, and ref key. 
A cell’s contents are updated by writing a new version with a higher ref key but same row key and column name. 
Schemaless does not enforce any schema on the data stored within it; hence the name. 
From Schemaless’s point of view, it just stores JSON objects. Schemaless uniquely supports efficient, 
eventually consistent secondary indexes over the cells’ fields.

## Architecture

Schemaless has two types of nodes: worker nodes and storage nodes, 
located either on the same physical/virtual host or on separate hosts. 
Worker nodes receive client-side requests, fan out the requests to the storage nodes, and aggregate the results. 
The storage nodes contain data in such a way that single or multiple cell retrieval on the same storage node is fast. 
We separate the two node types to scale each part independently. An overview of Schemaless is shown below:

![](/images/blog/store/schemaless_overview-1024x820.png)

## Worker Nodes

Schemaless clients communicate with the worker nodes via HTTP endpoints. 
These route requests to the storage nodes, aggregate the results from storage nodes if needed, and handle background jobs. 
In order to handle slow or failing worker nodes, 
a client-side library will transparently try other hosts and retry failing requests. 
Write requests to Schemaless are idempotent, so every request is safe to retry (a really nice property to have). 
This feature is exploited by the client library.

## Storage Nodes

We divide the data set into a fixed number of shards (typically configured to 4096), which we then map to storage nodes. 
A cell is mapped to a shard based on the row key of the cell. 
Each shard is replicated to a configurable number of storage nodes. 
Collectively, these storage nodes form a storage cluster, each consisting of one master and two minions. 
Minions (also known as replicas) are distributed across multiple data centers to provide data redundancy 
in case of a catastrophic data center outage.

### Read and Write Requests

When Schemaless serves a read request, 
such as reading a cell or querying an index, worker nodes can read the data from any storage node in its cluster. 
Reading from the master’s or minion’s storage nodes is configurable on a per request basis; 
the default is to read from the master, which means the client is guaranteed to see the result of its write request. 
Write requests (requests that insert cells), must go to the master of the cells’ cluster. 
After updating the master’s data, the storage node replicates the update asynchronously to the cluster’s minions.

### Dealing with Failure

An interesting aspect of distributed datastore systems is how they deal with failure, 
such as a storage node failing to respond to requests (master or minion). 
Schemaless is designed to minimize the impact of read and write request failures of storage nodes.

### Read Requests

The setup of masters and minions implies that it can serve read requests as long as one node in a cluster is available. 
If the master is available, Schemaless can always return the latest data by querying it. 
If the master is unavailable, some data might not have propagated to the minion, so Schemaless may return stale data. 
In production, however, we typically see subsecond latency on the replication, so minions’ data tends to be fresh. 
Worker nodes use the circuit breaker pattern on storage node connections to detect when a storage node is in trouble. 
This way, reads failover to another node.

### Write Requests

A minion going down does not impact writes; they go to the master. But if the master is down, 
Schemaless still accepts write requests, but they’re persisted to disk on another (randomly chosen) master. 
This is similar to hinted handoff in systems such as Dynamo or Cassandra. 
Writing to another master means 
that subsequent read requests cannot read these writes before the master is up or if a minion is promoted. 
In fact, Schemaless always writes to other masters to handle the failures in the asynchronous replication; 
we call this technique buffered writes (described in the next section).

Using a single node for receiving writes yields a number of advantages and disadvantages. 
One advantage is that it gives a total order on writes to each shard. This is an important property for Schemaless triggers, 
our asynchronous processing framework (mentioned in the first Schemaless article), 
as it can read data for a shard from any node and still guarantee the same processing order. 
The cell write order is the same on all nodes in the cluster. 
So in some sense, Schemaless’s shards can be viewed as a partitioned cell revisions log.

The most prominent disadvantage with a single master is if the master in a cluster is down, 
we buffer the writes somewhere else where they cannot be read. 
The upside to this inconvenient situation is that Schemaless can tell the client if the master is down, 
so the client will know that the written cell is not immediately reads-available.

## Buffered Writes

Since Schemaless uses MySQL asynchronous replication, the write will be lost if a master receives a write request, 
persists the request, and then fails before it has replicated the write to the minions (e.g., in a hard drive failure). 
To solve this problem we use a technique called buffered writes. 
Buffered writes minimize the chance of losing data by writing it to multiple clusters. 
If a master is down, the data is not readily available for subsequent reads but has nevertheless been persisted.

With buffered writes, when a worker node receives a write request, 
it writes the request to two clusters: a secondary and a primary (in that order). 
The client is told that the write succeeded only if both succeed. See the diagram below:

![](/images/blog/store/buffered_writes_diagram-1024x747.png)

The primary master is where the data is expected to be found on subsequent reads. 
In case the primary cluster’s master goes down before the asynchronous MySQL replication has replicated the cell 
to the primary minions, the secondary master serves as a temporary backup of the data.

The secondary master is chosen at random, and the write goes into a special buffer table. 
A background job monitors the primary minions for when the cell appears; 
only then does it delete the cell from the buffer table. 
Having the secondary cluster means all data is written on at least two hosts. 
Additionally, the number of secondary masters is configurable.

Buffered writes utilize idempotency; if a cell with a given row key, column name, 
and ref key already exists, the write is rejected. 
The idempotency aspect means that as long as the buffered cells have a different row key, column name, and ref key, 
they will all be written to the primary cluster when its master is back up. 
On the other hand, if multiple writes with the same row key, column name, and ref key are buffered, 
then only one of them will succeed; when the primary cluster comes back up, the rest are rejected.

## Using MySQL as a Storage Backend

A lot of the power (and simplicity) of Schemaless comes from our use of MySQL in the storage nodes. 
Schemaless itself is a relatively thin layer on top of MySQL for routing requests to the right database. 
By using MySQL indexes and the caching built into InnoDB, we get fast query performance for cells and secondary indexes.

Each Schemaless shard is a separate MySQL database, and each MySQL database server contains a set of MySQL databases. 
Each database contains a MySQL table for the cells (called the entity table) and a MySQL table for each secondary index, 
along with a set of auxiliary tables. 
Each Schemaless cell is a row in the entity table and has the following MySQL table definition:


Name | Type
:---|:---:
added_id    | int,auto-increment
row_key     | uuid
column_name | string
ref_key 	| int
body 	    | blob
created_at 	| datetime

The added_id column is an auto-increment integer column, and it is the MySQL primary key for the entity table. 
Having added_id as the primary key makes MySQL write the cells linearly on disk. 
Furthermore, added_id serves as a unique pointer for each cell 
that Schemaless triggers use to efficiently extract cells in order of insertion time.

The row_key, column_name, and ref_key columns contain, unsurprisingly, the row key, 
column name and ref key for each Schemaless cell. To efficiently look up a cell via these three, 
we define a compound MySQL index on these three columns. 
Thus, we can efficiently find all the cells for a given row key and column name.

The body column contains the JSON object of the cell as a compressed MySQL blob. 
We experimented with various encodings and compression algorithms 
and ended up using MessagePack and ZLib due to the compression speed and size. (More on this in a future article.) 
Lastly, the created_at column is used to timestamp 
the cell when we insert it and is useable by Schemaless triggers to find cells after a given date.

With this setup, we let the client control the schema without making changes to the layout in MySQL; 
we are able to look up cells efficiently. 
Furthermore, the added_id column makes inserts write out linearly on disk 
so we can efficiently access the data as a partitioned log.

## Summary

Schemaless today is the production datastore of a large number of services in Uber’s infrastructure. 
Many of our services rely heavily on the high availability and scalability of Schemaless.

## 参考
- [Uber's Scalable Datastore Using MySQL 1](https://eng.uber.com/schemaless-part-one/)
- [Uber's Scalable Datastore Using MySQL 2](https://eng.uber.com/schemaless-part-two/)
- [Uber's Scalable Datastore Using MySQL 3](https://eng.uber.com/schemaless-part-three/)
- [How FriendFeed uses MySQL to store schema-less data](https://backchannel.org/blog/friendfeed-schemaless-mysql)

[-10]:    http://hushi55.github.io/  "-10"
[Mezzanine]: http://eng.uber.com/mezzanine-migration/ "Mezzanine"
[Friendfeed]: https://backchannel.org/blog/friendfeed-schemaless-mysql "Friendfeed"
[Pinterest]: http://gotocon.com/dl/goto-aar-2014/slides/MartyWeiner_ScalingPinterest.pdf "Pinterest"

