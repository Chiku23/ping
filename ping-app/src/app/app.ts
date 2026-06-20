import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Home } from './home/home';
import { Header } from './component/header/header';
import { Login } from './component/login/login';
import { Settings } from './component/settings/settings';
import { ChatService } from './services/chat.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, Home, Header, Login, Settings],
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('angularapp');
  readonly chatService = inject(ChatService);

  constructor() {
    (window as any).handleAndroidBackButton = () => {
      if (this.chatService.activeView() === 'settings') {
        this.chatService.activeView.set('chat');
        return true;
      }
      if (this.chatService.activeView() === 'chat') {
        if (this.chatService.showChatMobile()) {
          this.chatService.closeChatMobile();
          return true;
        }
      }
      return false;
    };
  }
}


