import { prisma } from "../utils/prisma.js";
import { Status, transaction_status, type Transactions } from "../generated/prisma/client.js";
import { payment, paystackWebhook } from "../utils/transaction.js";
import type { KafkaService } from "@enterprise/kafka-common";
import { kafkaService } from "../utils/kafka.js";
import { Topics } from "@enterprise/kafka-common";
import { createHash } from "node:crypto";
import { redis } from "../utils/redis.js";
import type {
  Decimal,
  OrdersFindManyArgs,
  OrdersWhereInput,
} from "../generated/prisma/internal/prismaNamespace.js";
import { getProduct, getProducts } from "../utils/RpcClientFunctions.js";
import type {
  now_toI,
  OrdersI,
  PaginateI,
  TransactionsI,
} from "../utils/RpcServerfunctions.js";
import CustomError from "../utils/CustomError.js";
import type { ServerUnaryCall } from "@grpc/grpc-js";
import { APIFeatures } from "../utils/ApiFeatures.js";
import { invalidateCacheByPattern } from "../utils/invalidateCache.js";
import { v4 as uuidv4 } from "uuid";
import { Redis } from "ioredis";

type paystackEvent =
  | "charge.success"
  | "charge.failed"
  | "transfer.failed"
  | "transfer.success"
  | "transfer.reversed";
interface ResponseI<T = any> {
  event: paystackEvent;
  data: T;
}

interface TransactionOI {
  id: string;
  status: transaction_status;
}
interface TransactionI {
  id: string;
  created_at: string;
  amount: Decimal;
  order_id: string;
  status: string;
  update_at: string;
}

interface revenueI {
  total_amount: number;
}

interface Order_productsI {
  id: string;
  product_id: string;
  quantity: number;
  price: Decimal;
  order_id: string;
}
interface ProductI {
  id: string;
  name: string;
  category_id: string;
  description: string;
  price: number;
  sku: string;
}
interface Cart_itemsI {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  price: number;
}
interface OrderI {
  id: string;
  user_id: string;
  status: string;
  products?: Order_productsI[];
  transaction?: TransactionOI[] | null;
  payment_status: string;
  total_price: Decimal;
  created_at: Date;
}

interface OrderIA {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_price: Decimal;
  created_at: String;
}
export class ShoppingService {
  private prisma;
  private kafkaservice: KafkaService;

  constructor() {
    this.prisma = prisma;
    this.kafkaservice = kafkaService;
  }

  // async Cart(user_id: string) {
  //   return this.prisma.cart.findFirst({ where: { user_id } });
  // }

  //   async GetCartById(user_id: string) {
  //     return this.prisma.cart
  //   }

  async ManageCart(
    user_id: string,
    product: Partial<ProductI>,
    qty: number,
    is_remove: boolean,
  ) {
    const cart = await this.prisma.$transaction(async (tx) => {
      const cart = await tx.carts.findUnique({
        where: { user_id: user_id },
        include: { cart_items: true },
      });
      if (cart) {
        const productId: string = product.id as string;
        if (is_remove) {
          await tx.cart_Items.delete({
            where: {
              cart_id_product_id: {
                cart_id: cart?.id as string,
                product_id: productId,
              },
            },
          });
        } else {
          const newcart = await prisma.cart_Items.upsert({
            where: {
              cart_id_product_id: {
                cart_id: cart?.id as string,
                product_id: productId,
              },
            },

            update: {
              quantity: qty,
            },
            create: {
              cart_id: cart?.id as string,
              product_id: productId,
              quantity: qty,
              price: product.price as number,
            },
          });
          return newcart;
        }
      } else {
        const newCart = await tx.carts.create({
          data: {
            user_id,
            cart_items: {
              create: {
                product_id: product.id as string,
                quantity: qty,
                price: product.price as number,
              },
            },
          },
        });
        return newCart;
      }
    });

    return cart;
  }

  async addToCart(user_id: string, product_id: string, qty: number) {
    // grab product from product service throug RPC
    const productResponse: ProductI | null = await getProduct(product_id);

    console.log(productResponse);
    if (productResponse && productResponse.id === product_id) {
      const data = await this.ManageCart(user_id, productResponse, qty, false);
      console.log(data);
      return data;
    }

    throw new CustomError("Product not found", 404);
  }

  async ManageWishlist(
    user_id: string,
    product: Partial<ProductI>,
    is_remove = false,
  ) {
    const wishlist = await this.prisma.$transaction(async (tx) => {
      const wishlist = await tx.wishlists.findFirst({
        where: { user_id },
        include: { wishlist_items: true },
      });

      if (wishlist) {
        const productId: string = product.id as string;
        if (is_remove) {
          return await tx.wishlist_items.delete({
            where: {
              wishlist_id_product_id: {
                wishlist_id: wishlist.id,
                product_id: productId,
              },
            },
          });
        } else {
          const newWishlist = await tx.wishlist_items.create({
            data: {
              // wishlist_id: wishlist.id,
              product_id: productId,
              wishlist: {
                connect: { id: wishlist.id },
              },
            },
          });
          return newWishlist;
        }
      } else {
        const newWishlist = await tx.wishlists.create({
          data: {
            user_id,
            wishlist_items: {
              create: {
                product_id: product.id as string,
              },
            },
          },
        });

        return newWishlist;
      }
    });

    return wishlist;
  }

  async addToWishlist(user_id: string, product_id: string) {
    const productResponse: ProductI | null = await getProduct(product_id);

    if (productResponse && productResponse.id === product_id) {
      const data = await this.ManageWishlist(user_id, productResponse, false);

      return data;
    }

    throw new CustomError("Product data not found", 404);
  }

  async GetCartByCustomerId(user_id: string) {
    const cart = await this.prisma.carts.findFirst({
      where: { user_id },
      include: {
        cart_items: true,
      },
    });

    if (!cart || cart.cart_items.length === 0) {
      return {};
    }

    const cart_items = cart?.cart_items;
    console.log(cart_items);

    if (Array.isArray(cart_items)) {
      const ids = cart_items.map(({ product_id }) => product_id);

      console.log(ids);
      //perform RPC call to get the products info from product service and format the response

      const productResponse: { items: ProductI[] } = await getProducts(ids);
      const Responsemaps = productResponse?.items.map((item: any) => item);
      const productMap: Record<string, ProductI> = {};

      for (const product of Responsemaps ?? []) {
        productMap[product.id] = product;
      }

      return {
        id: cart.id,
        user_id: cart.user_id,
        items: cart.cart_items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          product: productMap[item.product_id] ?? null,
        })),
      };
    }

    return {};
  }
  async GetWishlistByCustomerId(user_id: string) {
    const wishlist = await this.prisma.wishlists.findFirst({
      where: { user_id },
      include: { wishlist_items: true },
    });

    if (!wishlist || wishlist.wishlist_items.length === 0) {
      return {};
    }

    const products = wishlist.wishlist_items;

    if (Array.isArray(products)) {
      const ids = products.map(({ product_id }) => product_id);

      // perform RPC call to product service to get the products using the ids
      const productResponse: { items: ProductI[] } = await getProducts(ids);
      const Responsemaps = productResponse?.items.map((item: any) => item);
      const productMap: Record<string, ProductI> = {};

      for (const product of Responsemaps ?? []) {
        productMap[product.id] = product;
      }

      return {
        id: wishlist.id,
        user_id: wishlist.user_id,
        items: wishlist.wishlist_items.map((item) => ({
          id: item.id,
          product: productMap[item.product_id] ?? null,
        })),
      };
    }

    return {};
  }

  async GetOrders(user_id: string, query: Record<string, string | undefined>) {
    const features = new APIFeatures<OrdersFindManyArgs, OrdersWhereInput>(
      query,
    )
      .filter(user_id)
      .sort()
      .paginate()
      .build();
    const orders = await this.prisma.orders.findMany({
      ...features,
      include: { products: true },
    });

    if (!orders) {
      return {};
    }
    const result = [];
    for (const order of orders) {
      const ids = order.products.map(({ product_id }) => product_id);

      const productResponse: { items: ProductI[] } = await getProducts(ids);
      const Responsemaps = productResponse?.items.map((item: any) => item);
      const productMap: Record<string, ProductI> = {};

      for (const product of Responsemaps ?? []) {
        productMap[product.id] = product;
      }
      result.push({
        id: order.id,
        user_id: order.user_id,
        status: order.status,
        Payment_status: order.payment_status,
        total_price: order.total_price,
        items: order.products.map((item) => ({
          id: item.id,
          order_id: item.id,
          quantity: item.quantity,
          product: productMap[item.product_id] ?? null,
        })),
      });
    }

    return result;
  }

  async GetOrderbyId(order_id: string) {
    const order = await this.prisma.orders.findFirst({
      where: { id: order_id },
      include: {
        products: true,
      },
    });

    if (!order || order.products.length === 0) {
      return {};
    }

    const products = order.products;
    if (Array.isArray(products)) {
      const ids = products.map(({ product_id }) => product_id);

      //perform RPC to get the products in the order
      const productResponse: { items: ProductI[] } = await getProducts(ids);
      const Responsemaps = productResponse?.items.map((item: any) => item);
      const productMap: Record<string, ProductI> = {};

      for (const product of Responsemaps ?? []) {
        productMap[product.id] = product;
      }
      return {
        id: order.id,
        status: order.status,
        Payment_status: order.payment_status,
        total_price: order.total_price,
        items: order.products.map((item) => ({
          id: item.id,
          order_id: item.id,
          quantity: item.quantity,
          product: productMap[item.product_id] ?? null,
        })),
      };
    }

    return {};
  }

  async CreateNewOrder(user_id: string, email: string) {
    let order: OrderI | null = null;
    if (!user_id || !email) {
      throw new CustomError("login before checking out", 400);
    }
    const cart = await this.prisma.carts.findFirst({
      where: { user_id },
      include: {
        cart_items: true,
      },
    });

    if (cart) {
      let total_amount: number = 0;

      const items: Cart_itemsI[] = cart.cart_items.map((item) => ({
        ...item,
        price: item.price.toNumber(),
      }));

      if (items.length > 0) {
        total_amount = items.reduce((prev, curr) => {
          const qty = curr.quantity ?? 1;
          return prev + curr.price * qty;
        }, 0);

        const cartItems = 
          cart.cart_items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price.toNumber(),
          }))
        ;
        console.log(cartItems);

        const idempotency_key = createHash("sha256")
          .update(user_id as string)
          .update(JSON.stringify(cartItems))
          .update(total_amount.toString())
          .digest("hex");

        console.log(idempotency_key);

        // store idempotency key in redis
        const redisKey: string = `shopping-service:idemkey:${idempotency_key}`;
        const userKey: string = `orders:user${user_id}:*`;
        const is_exist = await redis.hgetall(redisKey);
        const correlation_id = uuidv4();
        console.log(is_exist);
        if (Object.keys(is_exist).length === 0) {
          order = await this.prisma.$transaction(async (tx) => {
            const newOrder = await tx.orders.create({
              data: {
                user_id,
                total_price: total_amount,
              },
              include: { products: true },
            });

            await tx.order_items.createMany({
              data: items.map((item) => ({
                order_id: newOrder.id,
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.price,
              })),
            });

            const neworder = await tx.orders.findUnique({
              where: {
                id: newOrder.id,
              },
              include: {
                products: true,
                transaction: true,
              },
            });

            return neworder;
          });

          // console.log(order.id);
          await redis.hset(redisKey, {
            order_id: order?.id,
            amount: total_amount.toString(),
            status: order?.status,
          });
          console.log("ososo");

          await redis.expire(redisKey, 60 * 60);
          // invalidate
          await invalidateCacheByPattern(userKey);
          await invalidateCacheByPattern(`orders:admin:*`);
          // return {
          //   order,
          // };
        } else {
          //set the status at the webhook
          if (is_exist.status === "successful") {
            return {};
          }

          order = await prisma.orders.findUnique({
            where: {
              id: is_exist.order_id as string,
            },
            include: {
              transaction: {
                select: {
                  id: true,
                  status: true,
                  amount: true,
                },
              },
              products: true,
            },
          });

          if (is_exist.amount !== total_amount.toString()) {
            throw new CustomError("Idempotency key reuse with mismatch", 400);
          }

          if (!order) {
            await redis.del(redisKey);
            order = await this.prisma.$transaction(async (tx) => {
              const newOrder = await tx.orders.create({
                data: {
                  user_id,
                  total_price: total_amount,
                },
                include: { products: true },
              });

              await tx.order_items.createMany({
                data: items.map((item) => ({
                  order_id: newOrder.id,
                  product_id: item.product_id,
                  quantity: item.quantity,
                  price: item.price,
                })),
              });

              const neworder = await tx.orders.findUnique({
                where: {
                  id: newOrder.id,
                },
                include: {
                  products: true,
                  transaction: true,
                },
              });

              return neworder;
              // throw new CustomError("Order not found", 404)
            });
          }
        }
        const channelName = `order_payment_url:${correlation_id}`;

        const subscriber = new Redis({
          host: "localhost",
          port: 6379,
        });

        subscriber.subscribe(channelName, (err, count) => {
          if (err) {
            return;
          }
          console.log(`subscribed to ${count} channels`);
        });

        const waitForURL = new Promise<string | null>((resolve, reject) => {
          const timeout = setTimeout(async () => {
            await subscriber.unsubscribe(channelName);
            subscriber.disconnect();
            reject(
              new CustomError("Timed out waiting for payment gateway", 504),
            );
          }, 5000);

          subscriber.on("message", async (channel, message) => {
            clearTimeout(timeout);
            const data = JSON.parse(message);

            await subscriber.unsubscribe(channelName);
            await subscriber.quit();
            console.log(data);

            resolve(data);
          });
          // subscriber.subscribe(channelName, async (message) => {
          //   clearTimeout(timeout);

          //   const data = JSON.parse(message);
          //   await subscriber.unsubscribe(channelName);
          //   subscriber.disconnect();
          //   resolve(data.paymentURL);
          // });
        });

        // order created event to inventory
        const event_id = uuidv4();
        console.log(order);
        await this.kafkaservice.publish(Topics.ORDER_CREATED, [
          {
            value: { order, email, correlation_id },
            headers: {
              event_id,
            },
          },
        ]);

        // console.log("off")

        const response = await waitForURL;
        return { order, response };

        // move this to payment webhook success handler
        // await this.prisma.cart_Items.deleteMany({
        //   where: { cart_id: cart.id },
        // });
      }
      return {};
    }
    return {};
  }
  async payment_service(
    order: OrderI,
    email: string,
    correlation_id: string,
    event_id: string,
  ) {
    await payment(order, email, correlation_id, event_id);
  }

  async webhook(body: ResponseI, signature: string) {
    await paystackWebhook(body, signature);
  }
  async total_revenue(
    call: ServerUnaryCall<now_toI, revenueI>,
  ): Promise<revenueI> {
    const to = call.request.to;
    const now = call.request.now;
    console.log("to", to);
    console.log("now", now);
    const total: Array<{ sum: number }> = await this.prisma.$queryRaw`
    SELECT SUM(amount) 
    FROM "Transactions"
    WHERE status = 'successful' AND (created_at BETWEEN ${new Date(to)} AND ${new Date(now)})
    `;

    return {
      total_amount: total[0]?.sum ?? 0,
    };
  }

  async total_orders(call: ServerUnaryCall<PaginateI, { orders: OrderIA[]; nextCursor: string | null }>): Promise<{ orders: OrderIA[]; nextCursor: string | null }> {
    const allowedFields: Status[] = ["pending", "successful", "cancelled"];

    const newStatus: Status[]  = [];
    console.log("call.request", call.request);
    if (call.request.status !== 'undefined') {
      const formatted: any[] = call.request.status?.split(",");
      formatted.forEach((el) => {
        if (allowedFields.includes(el)) newStatus.push(el);
      });
    }
    console.log(new Date(Number(call.request.beforeTimestamp)))

    const where = {
      created_at: { lte: new Date(Number(call.request.beforeTimestamp) ?? Date.now()) as Date },
      ...(newStatus.length !== 0 && { status: { in: newStatus } }),
    };

    const orders: OrderI[] = await this.prisma.orders.findMany({
      where,
      take: call.request.limit ?? 10,
      select: {
        id: true,
        user_id: true,
        status: true,
        payment_status: true,
        total_price: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    });
    console.log(orders)

    if (orders.length === 0) {
      return {
        orders: [],
        nextCursor: "null",
      };
    }

    //const sorted = total.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    return {
      orders: orders.map((order) => ({
        ...order,
        created_at: String(new Date(order.created_at))
      })),
      nextCursor: String(orders[orders.length - 1]?.created_at?.getTime()) || null,
    };
  }

  // async pending_orders(limit = 20, beforeTimestamp = Date.now()) {
  //   const orders: OrderI[] = await this.prisma.orders.findMany({
  //     where: {
  //       status: "pending",
  //       created_at: { lte: new Date(beforeTimestamp) },
  //     },
  //     take: limit,
  //     orderBy: { created_at: "desc" },
  //   });

  //   if (orders.length === 0) {
  //     return {
  //       orders: [],
  //       nextCursor: null,
  //     };
  //   }

  //   return {
  //     orders,
  //     nextCursor: orders[orders.length - 1]?.created_at.getTime() || null,
  //   };
  // }

  async recent_transactions(
    call: ServerUnaryCall<PaginateI, { transactions: TransactionI[]; nextCursor: string | null }>,
  ): Promise<{ transactions: TransactionI[]; nextCursor: string | null }> {
    const allowedFields: transaction_status[] = [
      "pending",
      "successful",
      "failed",
    ];

    console.log("call.request", call.request);
    const newStatus: transaction_status[] = [];
    if (call.request.status !== 'undefined') {
      const formatted: any[] = call.request.status?.split(",");
      console.log(formatted)
      formatted.forEach((el) => {
        if (allowedFields.includes(el)) newStatus.push(el);
      });
    }

    
    const where = {
      created_at: { lte: new Date(Number(call.request.beforeTimestamp) ?? Date.now()) as Date},
      ...(newStatus.length !== 0 && { status: { in: newStatus } }),
    };
    const transactions: Transactions[] = await this.prisma.transactions.findMany({
      where,
      take: call.request.limit ?? 20,
      orderBy: { created_at: "desc" },
    });

    if (transactions.length === 0) {
      return {
        transactions: [],
        nextCursor: "null"
      };
    }

    return {
      transactions: transactions.map((transaction) => ({
        ...transaction,
        created_at: String(new Date(transaction.created_at)),
        update_at: String(new Date(transaction.update_at)),
      })),
      nextCursor:
        String(transactions[transactions.length - 1]?.created_at.getTime()) || null,
    };
  }

  // async SubscribeEvent()
}
