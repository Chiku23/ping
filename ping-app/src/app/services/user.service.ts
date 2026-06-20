// user.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private usersSignal = signal<any[]>(this.getInitialUsers());

  readonly users = this.usersSignal.asReadonly();

  private getInitialUsers(): any[] {
    const cached = localStorage.getItem('cached_users');
    return cached ? JSON.parse(cached) : [];
  }

  setUsers(users: any[]) {
    localStorage.setItem('cached_users', JSON.stringify(users));
    this.usersSignal.set(users);
  }

  deleteUser(id: any) {
    const updatedUsers = this.usersSignal().filter((user: any) => user.id !== id);
    localStorage.setItem('cached_users', JSON.stringify(updatedUsers));
    this.usersSignal.set(updatedUsers);
  }
}