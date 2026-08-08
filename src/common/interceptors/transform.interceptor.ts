import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: any;
  errors: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((res) => {
        let message = 'Operation successful';
        let data = res;
        let pagination = undefined;

        if (res && typeof res === 'object') {
          if ('message' in res && 'data' in res) {
            message = res.message;
            data = res.data;
            if ('pagination' in res) {
              pagination = res.pagination;
            }
          } else if ('pagination' in res && 'data' in res) {
            data = res.data;
            pagination = res.pagination;
          }
        }

        const formattedResponse: Response<T> = {
          success: true,
          message,
          data,
          errors: null,
        };

        if (pagination) {
          formattedResponse.pagination = pagination;
        }

        return formattedResponse;
      }),
    );
  }
}
