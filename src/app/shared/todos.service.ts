import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface Todo {
  serialNo?: number;
  title: string;
  id?: string;
  _id?: string;
  name: string;
  email: string;
  age: number | null;
  address: string;
  password: string;
  completed?: boolean;
  // Allow dynamic fields of type string or number or null
  [key: string]: string | number | boolean | null | undefined;
}

export interface Column {
  title: string;
  field: string;
  order?: number;
  width?: number;
  editable?: boolean;
}

export interface TableConfig {
  id?: string;
  _id?: string;
  name: string;
  columns: Column[];
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class TodosService {
  private apiUrl = 'https://table-backend.vercel.app';
  private todosEndpoint = `${this.apiUrl}/todo`;
  private configEndpoint = `${this.apiUrl}/table-config`;

  constructor(private http: HttpClient) {}

  // Todo operations
  getTodos(): Observable<Todo[]> {
    return this.http.get<Todo[]>(this.todosEndpoint);
  }

  addTodo(todo: Todo): Observable<Todo> {
    return this.http.post<Todo>(this.todosEndpoint, todo);
  }

  updateTodo(id: string, todo: Todo): Observable<Todo> {
    return this.http.put<Todo>(`${this.todosEndpoint}/${id}`, todo);
  }

  deleteTodo(id: string): Observable<any> {
    return this.http.delete(`${this.todosEndpoint}/${id}`);
  }

  // Table configuration operations
  getTableConfig(): Observable<TableConfig> {
    return this.http.get<TableConfig>(this.configEndpoint);
  }

  saveTableConfig(config: TableConfig): Observable<TableConfig> {
    if (config.id || config._id) {
      return this.http.put<TableConfig>(`${this.configEndpoint}/${config.id || config._id}`, config);
    } else {
      return this.http.post<TableConfig>(this.configEndpoint, config);
    }
  }

  updateTableConfig(id: string, config: Partial<TableConfig>): Observable<TableConfig> {
    return this.http.patch<TableConfig>(`${this.configEndpoint}/${id}`, config);
  }

  deleteTableConfig(id: string): Observable<any> {
    return this.http.delete(`${this.configEndpoint}/${id}`);
  }

  // Column operations
  addColumn(column: Column): Observable<TableConfig> {
    return this.http.post<TableConfig>(`${this.configEndpoint}/columns`, column);
  }

  updateColumn(columnId: string, column: Partial<Column>): Observable<TableConfig> {
    return this.http.put<TableConfig>(`${this.configEndpoint}/columns/${columnId}`, column);
  }

  deleteColumn(columnId: string): Observable<TableConfig> {
    return this.http.delete<TableConfig>(`${this.configEndpoint}/columns/${columnId}`);
  }

  // Bulk operations
  updateAllTodosWithNewColumn(columnField: string): Observable<Todo[]> {
    return this.http.patch<Todo[]>(`${this.todosEndpoint}/add-column`, { columnField });
  }

  removeColumnFromAllTodos(columnField: string): Observable<Todo[]> {
    return this.http.patch<Todo[]>(`${this.todosEndpoint}/remove-column`, { columnField });
  }
}
