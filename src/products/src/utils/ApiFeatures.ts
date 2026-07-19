//import { Prisma } from "@prisma/client";
import type {
  CurrentProductsFindManyArgs,
  Enumerable,
  SelectSubset,
  SortOrder,
} from "../generated/prisma/internal/prismaNamespace.js";
type QueryParams = Record<string, string | undefined>;

export class APIFeatures<T, whereInput extends object> {
  private queryParams: QueryParams;
  private prismaQuery: {
    where?: whereInput;
    orderBy?: Enumerable<Record<string, SortOrder>>; //Enumerable<Prisma.SortOrderInput>;
    skip?: number;
    take?: number;
    select?: Record<string, boolean>;
  } = {};
  constructor(queryParams: QueryParams) {
    this.queryParams = queryParams;
  }

  filter(category?: string): this {
    const queryObj = { ...this.queryParams };
    const excludedFields = ["page", "sort", "limit", "fields", "search"];
    excludedFields.forEach((el) => delete queryObj[el]);

    const where: Record<string, any> = {category};

    for (const key in queryObj) {
      if (!queryObj[key]) continue;

      if (Array.isArray(queryObj[key])) continue;

      const match = key.match(
        /(\w+)\[(gte|gt|lte|lt|contains|startswith|endswith)\]/,
      );
      if (match) {
        const field = match[1] as string;
        const operator = match[2] as string;
        where[field] = { [operator]: this.parseValue(queryObj[key])! };
      } else {
        where[key] = this.parseValue(queryObj[key])!;
      }
    }

    this.prismaQuery.where = where as whereInput;
    return this;
  }

  search(searchableFields: (keyof whereInput)[]): this {
    const { search } = this.queryParams;
    if (Array.isArray(search)) {
      return this;
    }
    if (search && searchableFields.length > 0) {
      const orConditions = searchableFields.map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      }));

      this.prismaQuery.where = {
        ...this.prismaQuery.where,
        OR: orConditions,
      } as whereInput;
    }

    return this;
  }

  sort(): this {
    const { sort } = this.queryParams;

    if (sort) {
      const sortFields = sort.split(",").map((field) => {
        if (field.startsWith("-")) {
          return { [field.substring(1)]: "desc" as SortOrder };
        }
        return { [field]: "asc" as SortOrder };
      });
      this.prismaQuery.orderBy = sortFields;
    } else {
      this.prismaQuery.orderBy = { created_at: "desc" as SortOrder };
    }
    return this;
  }

  paginate(): this {
    const beforeTimestamp = parseInt(
      this.queryParams.beforeTimestamp || String(Date.now()),
      10,
    );
    const limit = parseInt(this.queryParams.limit || "20", 10);

    this.prismaQuery.where = {
      ...this.prismaQuery.where,
      created_at: { lte: new Date(beforeTimestamp) },
    } as whereInput;
    this.prismaQuery.take = limit;
    return this;
  }

  select(): this {
    if (this.queryParams.fields) {
      const fields = this.queryParams.fields.split(",");
      this.prismaQuery.select = fields.reduce(
        (acc, field) => {
          acc[field.trim()] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      );
    }
    return this;
  }
  build(): SelectSubset<T, any> {
    return this.prismaQuery as SelectSubset<T, any>;
  }

  private parseValue(value: string): string | number | boolean {
    if (value === "true") return true;
    if (value === "false") return false;
    if (!isNaN(Number(value))) return Number(value);
    return value;
  }
}
