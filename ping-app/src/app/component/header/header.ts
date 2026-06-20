import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleUser, faHexagonNodes, faCog, faSync } from '@fortawesome/free-solid-svg-icons';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  host: {
    class: 'block w-full flex-shrink-0'
  }
})
export class Header {
  readonly chatService = inject(ChatService);

  faHexagonNodes = faHexagonNodes;
  faCircleUser = faCircleUser;
  faCog = faCog;
  faSync = faSync;

  goToSettings() {
    this.chatService.activeView.set('settings');
  }

  refreshPage() {
    window.location.reload();
  }
}


