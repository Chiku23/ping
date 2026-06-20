import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Chatbox } from './chatbox';

describe('Chatbox', () => {
  let component: Chatbox;
  let fixture: ComponentFixture<Chatbox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chatbox],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(Chatbox);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
