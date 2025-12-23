import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-three-editor',
  templateUrl: './three-editor.component.html',
  styleUrls: ['./three-editor.component.scss']
})
export class ThreeEditorComponent {
  editorUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    this.editorUrl = this.sanitizer.bypassSecurityTrustResourceUrl('assets/three-editor/editor/index.html');
  }
}
