export {}
interface UserI {
  id: string;
  email: string;
  role: "user" | "admin"
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    //   set?: Record<string, any>;
    }
  }
}