export {}
interface UserI {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    //   set?: Record<string, any>;
    }
  }
}