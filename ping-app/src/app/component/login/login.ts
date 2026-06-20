import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEnvelope, faPhone, faUser, faHexagonNodes, faLock, faServer, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  host: {
    class: 'block w-full h-full'
  }
})
export class Login {
  readonly chatService = inject(ChatService);

  faEnvelope = faEnvelope;
  faPhone = faPhone;
  faUser = faUser;
  faHexagonNodes = faHexagonNodes;
  faLock = faLock;
  faServer = faServer;
  faGlobe = faGlobe;

  name = signal<string>('');
  email = signal<string>('');
  mobile = signal<string>('');
  password = signal<string>('');

  isLoginMode = signal<boolean>(true);
  errorMessage = signal<string>('');
  showServerSettings = signal<boolean>(false);
  apiUrlInput = this.chatService.apiUrl();
  isTestingConnection = signal<boolean>(false);
  connectionStatus = signal<{ success: boolean; message: string } | null>(null);

  toggleServerSettings() {
    this.showServerSettings.update(val => !val);
  }

  onApiUrlChange(newUrl: string) {
    this.chatService.setApiUrl(newUrl);
    this.connectionStatus.set(null);
  }

  testConnection() {
    this.isTestingConnection.set(true);
    this.connectionStatus.set(null);
    this.chatService.testConnection(this.apiUrlInput).subscribe({
      next: (res) => {
        this.connectionStatus.set(res);
        this.isTestingConnection.set(false);
      },
      error: () => {
        this.connectionStatus.set({ success: false, message: 'An unexpected error occurred.' });
        this.isTestingConnection.set(false);
      }
    });
  }

  toggleMode() {
    this.isLoginMode.update(val => !val);
    this.errorMessage.set('');
    // Clear inputs
    this.name.set('');
    this.email.set('');
    this.mobile.set('');
    this.password.set('');
  }

  onSubmit() {
    const n = this.name().trim();
    const e = this.email().trim();
    const m = this.mobile().trim();
    const p = this.password();

    if (this.isLoginMode()) {
      if (!m || !p) {
        this.errorMessage.set('Mobile number and password are required.');
        return;
      }
      if (m.length < 8) {
        this.errorMessage.set('Please enter a valid mobile number.');
        return;
      }

      this.errorMessage.set('');
      this.chatService.login(m, p).subscribe({
        next: () => {
          this.errorMessage.set('');
        },
        error: (err) => {
          console.error(err);
          if (err.status === 0) {
            this.errorMessage.set(`Cannot connect to server at ${this.chatService.apiUrl()}.\n\n1. Ensure both devices are on the same Wi-Fi.\n2. On Fedora, run:\nsudo firewall-cmd --add-port=3000/tcp --zone=home --permanent && sudo firewall-cmd --reload`);
          } else {
            this.errorMessage.set(err.error?.error || 'Invalid credentials.');
          }
        }
      });
    } else {
      if (!n || !e || !m || !p) {
        this.errorMessage.set('All fields are required.');
        return;
      }

      // Basic Validation
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(e)) {
        this.errorMessage.set('Please enter a valid email address.');
        return;
      }

      if (m.length < 8) {
        this.errorMessage.set('Please enter a valid mobile number.');
        return;
      }

      if (p.length < 6) {
        this.errorMessage.set('Password must be at least 6 characters long.');
        return;
      }

      this.errorMessage.set('');
      this.chatService.signup(n, e, m, p).subscribe({
        next: () => {
          this.errorMessage.set('');
        },
        error: (err) => {
          console.error(err);
          if (err.status === 0) {
            this.errorMessage.set(`Cannot connect to server at ${this.chatService.apiUrl()}.\n\n1. Ensure both devices are on the same Wi-Fi.\n2. On Fedora, run:\nsudo firewall-cmd --add-port=3000/tcp --zone=home --permanent && sudo firewall-cmd --reload`);
          } else {
            this.errorMessage.set(err.error?.error || 'Sign up failed or mobile already exists.');
          }
        }
      });
    }
  }
}
