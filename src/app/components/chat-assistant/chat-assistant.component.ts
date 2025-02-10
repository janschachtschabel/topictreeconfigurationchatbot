import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { OpenAIService } from '../../services/openai.service';
import { firstValueFrom, Observable, map } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ThemenbaumService } from '../../services/themenbaum.service';
import { DISCIPLINE_MAPPING, EDUCATIONAL_CONTEXT_MAPPING, TARGET_GROUP_MAPPING } from '../../services/mappings';
import { MatSelectChange } from '@angular/material/select';

interface Message {
  sender: 'user' | 'bot';
  content: string;
}

interface FormState {
  themenbaumthema: string | null;
  hauptkategorien: number | null;
  unterkategorien: number | null;
  weitereUnterkategorien: number | null;
  bildungsstufen: string[];
  fachgebiete: string[];
  zielgruppen: string[];
  freigegeben: boolean;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * Angular-Komponente für den KI-gestützten Chat-Assistenten zur Themenbaum-Konfiguration.
 * Verwaltet die Benutzerinteraktion, Formularvalidierung und OpenAI-Integration.
 * @class
 */
@Component({
  selector: 'app-chat-assistant',
  templateUrl: './chat-assistant.component.html',
  styleUrls: ['./chat-assistant.component.scss']
})
export class ChatAssistantComponent implements OnInit, AfterViewChecked {
  /**
   * Liste aller Nachrichten im Chat
   */
  messages: Message[] = [];

  /**
   * Aktuelle Benutzereingabe
   */
  userInput = '';

  /**
   * Ladeindikator für die Verarbeitung der Benutzereingabe
   */
  isLoading = false;

  /**
   * Letzter Freigabestatus
   */
  private lastFreigabeState = false;

  /**
   * Formular für die Eingaben
   */
  formGroup!: FormGroup;

  /**
   * Liste der Bildungsstufen
   */
  readonly bildungsstufen = Object.keys(EDUCATIONAL_CONTEXT_MAPPING).filter(key => key !== "Keine Vorgabe");

  /**
   * Liste der Fachgebiete
   */
  readonly fachgebiete = Object.keys(DISCIPLINE_MAPPING).filter(key => key !== "Keine Vorgabe");

  /**
   * Liste der Zielgruppen
   */
  readonly zielgruppen = Object.keys(TARGET_GROUP_MAPPING).filter(key => key !== "Keine Vorgabe");

  /**
   * Referenz auf den Chat-Container
   */
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  /**
   * Flag, ob der Chat nach unten gescrollt werden soll
   */
  private shouldScroll = false;

  /**
   * Vorheriger Formularstand
   */
  private previousState: FormState | null = null;

  /**
   * Konstruktor für die Komponente
   * @param formBuilder - Formular-Builder
   * @param openaiService - OpenAI-Service
   * @param sanitizer - Dom-Sanitizer
   * @param themenbaumService - Themenbaum-Service
   * @param ngZone - NgZone
   */
  constructor(
    private formBuilder: FormBuilder,
    private openaiService: OpenAIService,
    private sanitizer: DomSanitizer,
    private themenbaumService: ThemenbaumService,
    private ngZone: NgZone
  ) { }

  /**
   * Initialisiert die Komponente bei der Erstellung.
   * Setzt das Formular auf und zeigt die initiale Willkommensnachricht.
   * @implements {OnInit}
   */
  ngOnInit() {
    this.initForm();
    this.addBotMessage('Hallo! Ich bin Boerdie, ein freundlicher KI-Assistent für die Konfiguration eines Themenbaums für Bildungsinhalte. Ich unterstütze dich bei der Erstellung eines Themenbaums mit 3 Hierarchieebenen: Hauptkategorien, Unterkategorien und weitere Unterkategorien. Bitte beschreibe das Thema, das der Themenbaum repräsentieren soll.');
  }

  /**
   * Lifecycle-Hook, der nach jeder Änderung der View aufgerufen wird.
   * Steuert das automatische Scrollen des Chat-Containers.
   * @implements {AfterViewChecked}
   */
  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  /**
   * Scrollt den Chat-Container zum letzten Element.
   * Wird nach dem Hinzufügen neuer Nachrichten aufgerufen.
   * @private
   * @throws {Error} Wenn das Scrollen fehlschlägt
   */
  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  /**
   * Verarbeitet die Benutzereingabe und kommuniziert mit dem OpenAI-Service.
   * Parsed die Antwort und aktualisiert den Formularstatus.
   * @private
   * @param {string} input - Die zu verarbeitende Benutzereingabe
   * @returns {Promise<void>}
   */
  private async processUserInput(input: string) {
    this.isLoading = true;

    try {
      const response = await firstValueFrom(this.getChatResponse(input));
      
      if (response && response.choices && response.choices[0]?.message?.content) {
        const messageContent = response.choices[0].message.content;
        this.addBotMessage(messageContent);
        
        // Parse die Antwort und aktualisiere das Formular
        this.parseConversation(messageContent).subscribe(
          (parsedState) => {
            if (parsedState) {
              // Führe das Update in der Zone aus
              this.ngZone.run(() => {
                this.updateFormState(parsedState);
              });
            }
          },
          (error) => {
            console.error('Error parsing conversation:', error);
          }
        );
      }
    } catch (error) {
      console.error('Error processing user input:', error);
      this.addBotMessage('Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuche es erneut.');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Erstellt und sendet eine Anfrage an den OpenAI-Service.
   * Fügt den Konversationsverlauf und Systemprompt hinzu.
   * @private
   * @param {string} input - Die Benutzereingabe
   * @returns {Observable<OpenAIResponse>} Observable mit der API-Antwort
   */
  private getChatResponse(input: string): Observable<OpenAIResponse> {
    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: this.getChatPrompt()
      }
    ];

    // Add conversation history
    const recentMessages = this.messages.slice(-6).map(msg => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content
    }));
    messages.push(...recentMessages);

    // Add current message
    messages.push({
      role: 'user' as const,
      content: input
    });

    return this.openaiService.sendMessage(messages);
  }

  /**
   * Generiert den Systemprompt für den OpenAI-Service.
   * Enthält Anweisungen für das KI-Modell und den aktuellen Zustand.
   * @private
   * @returns {string} Der generierte Prompt
   */
  private getChatPrompt(): string {
    const currentState = this.formGroup.value;
    const nextStep = this.determineNextStep(currentState);
    
    return `Du bist Boerdie, ein freundlicher KI-Assistent für die Konfiguration eines Themenbaums für Bildungsinhalte.

VERFÜGBARE WERTE:
Bildungsstufen: ${this.bildungsstufen.join(', ')}
Fachgebiete: ${this.fachgebiete.join(', ')}
Zielgruppen: ${this.zielgruppen.join(', ')}

AKTUELLER STAND:
${JSON.stringify(currentState, null, 2)}

ABLAUF (Strikt in dieser Reihenfolge):
1. Themenbaumthema erfragen
2. Anzahl der Hauptkategorien festlegen (1-30, Empfehlung: 10-12)
3. Anzahl der Unterkategorien festlegen (0-20)
4. Anzahl der Weiteren Unterkategorien festlegen (0-20)
5. Abfrage, ob man bereits einige Metadaten für den Themenbaum festlegen möchte oder direkt zur Zusammenfassung springen möchte.
6. Optional: Bildungsstufen
7. Optional: Fachgebiete
8. Optional: Zielgruppen
9. Zusammenfassung präsentieren und direkt um Freigabe bitten

NÄCHSTER SCHRITT:
${nextStep}

VERHALTEN:
1. Führe den Benutzer strikt Schritt für Schritt durch den Prozess
2. Stelle immer nur eine Frage auf einmal
3. Zeige nicht alle verfügbaren Werte, sondern bitte den Nutzenden um eine Antwort
4. Bestätige erhaltene Antworten
5. Falls die Eingabe des Nutzenden nicht den verfügbaren Werten entspricht, versuche ihn im Dialog darauf zu orientieren
6. Bei der Zusammenfassung direkt um Freigabe bitten
7. Bei Ablehnung der Freigabe, frage nach was geändert werden soll

WICHTIG:
- Bleibe freundlich und hilfsbereit
- Gib Empfehlungen wenn sinnvoll
- Validiere die Eingaben gegen die verfügbaren Werte
- Formatiere deine Antworten in Markdown:
  - Verwende **fett** für wichtige Begriffe
  - Nutze \`code\` für Zahlenwerte
  - Strukturiere mit # und ## für Überschriften
  - Verwende - für Aufzählungen
- Bei der Zusammenfassung:
  1. Präsentiere alle Eingaben übersichtlich
  2. Bitte direkt um Freigabe mit einer Formulierung wie "Bitte prüfe die Zusammenfassung und gib den Themenbaum frei, wenn alles korrekt ist. Falls Änderungen nötig sind, teile mir bitte mit, was angepasst werden soll."`;
  }

  /**
   * Analysiert die Konversation und extrahiert relevante Formularwerte.
   * Berücksichtigt den aktuellen Formularstand bei der Extraktion.
   * @private
   * @param {string} conversation - Die zu analysierende Konversation
   * @returns {Observable<FormState | null>} Observable mit dem geparsten Zustand
   */
  private parseConversation(conversation: string): Observable<FormState | null> {
    // Aktuellen Formularstand für Kontext hinzufügen
    const currentState = this.formGroup.value;
    const stateInfo = `
AKTUELLER FORMULARSTAND:
- Thema: ${currentState.themenbaumthema || 'nicht gesetzt'}
- Hauptkategorien: ${currentState.hauptkategorien !== null ? currentState.hauptkategorien : 'nicht gesetzt'}
- Unterkategorien: ${currentState.unterkategorien !== null ? currentState.unterkategorien : 'nicht gesetzt'}
- Weitere Unterkategorien: ${currentState.weitereUnterkategorien !== null ? currentState.weitereUnterkategorien : 'nicht gesetzt'}
- Bildungsstufen: ${currentState.bildungsstufen.length > 0 ? currentState.bildungsstufen.join(', ') : 'keine'}
- Fachgebiete: ${currentState.fachgebiete.length > 0 ? currentState.fachgebiete.join(', ') : 'keine'}
- Zielgruppen: ${currentState.zielgruppen.length > 0 ? currentState.zielgruppen.join(', ') : 'keine'}
- Freigegeben: ${currentState.freigegeben ? 'ja' : 'nein'}

KONVERSATIONSVERLAUF:
${conversation}`;

    const message: OpenAIMessage = {
      role: 'user',
      content: this.getParserPrompt(stateInfo)
    };

    return this.openaiService.sendMessage([message]).pipe(
      map((response: OpenAIResponse) => {
        try {
          console.log('Parser response:', response.choices[0].message.content);
          const parsed = JSON.parse(response.choices[0].message.content);
          return this.validateParsedState(parsed);
        } catch (e) {
          console.error('Failed to parse state:', e);
          return null;
        }
      })
    );
  }

  /**
   * Generiert den Prompt für den Parser-Service.
   * Definiert das erwartete Format und die Extraktionsregeln.
   * @private
   * @param {string} conversation - Die zu parsende Konversation
   * @returns {string} Der generierte Parser-Prompt
   */
  private getParserPrompt(conversation: string): string {
    return `Analysiere die folgende Konversation und extrahiere die relevanten Werte in einem JSON-Format.
Berücksichtige nur definitive Aussagen und ignoriere unklare oder widersprüchliche Angaben.
Beachte besonders den aktuellen Formularstand und extrahiere nur Änderungen, die sich aus der letzten Konversation ergeben.

VERFÜGBARE WERTE:
Bildungsstufen: ${this.bildungsstufen.join(', ')}
Fachgebiete: ${this.fachgebiete.join(', ')}
Zielgruppen: ${this.zielgruppen.join(', ')}

${conversation}

ERWARTETES FORMAT:
{
  "themenbaumthema": string | null,    // Extrahiertes Thema oder null
  "hauptkategorien": number | null,     // Zahl zwischen 1-30 oder null
  "unterkategorien": number | null,     // Zahl zwischen 0-20 oder null
  "weitereUnterkategorien": number | null, // Zahl zwischen 0-20 oder null
  "bildungsstufen": string[],          // Nur Werte aus der Liste oben
  "fachgebiete": string[],             // Nur Werte aus der Liste oben
  "zielgruppen": string[],             // Nur Werte aus der Liste oben
  "freigegeben": boolean              // true wenn explizit freigegeben, sonst false
}

REGELN:
1. Extrahiere nur klar kommunizierte Werte
2. Bei Unsicherheit verwende null für Einzelwerte oder leere Arrays für Listen
3. Validiere Zahlenbereiche:
   - hauptkategorien: 1-30
   - unterkategorien: 0-20
   - weitereUnterkategorien: 0-20
4. Verwende nur die verfügbaren Werte für Arrays
5. Setze freigegeben auf true wenn:
   - Der Benutzer explizit zustimmt/bestätigt
   - Positive Antworten wie "ja", "einverstanden", "passt so", etc.
6. Ignoriere widersprüchliche Angaben
7. Berücksichtige den aktuellen Formularstand und extrahiere nur neue oder geänderte Werte

Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text.`;
  }

  /**
   * Bestimmt den nächsten Schritt im Konfigurationsprozess.
   * Basiert auf dem aktuellen Formularstand.
   * @private
   * @param {FormState} state - Der aktuelle Formularstand
   * @returns {string} Beschreibung des nächsten Schritts
   */
  private determineNextStep(state: FormState): string {
    if (!state.themenbaumthema) {
      return "Erfrage das Thema des Themenbaums.";
    }
    if (state.themenbaumthema && state.hauptkategorien === null) {
      return "Erfrage die Anzahl der Hauptkategorien (1-30, empfohlen: 10-12).";
    }
    if (state.hauptkategorien !== null && state.unterkategorien === null) {
      return "Erfrage die Anzahl der Unterkategorien (0-20).";
    }
    if (state.unterkategorien !== null && state.weitereUnterkategorien === null) {
      return "Erfrage die Anzahl der weiteren Unterkategorien (0-20).";
    }
    if (state.weitereUnterkategorien !== null && 
        (state.bildungsstufen.length === 0 || 
         state.fachgebiete.length === 0 || 
         state.zielgruppen.length === 0)) {
      return "Biete an, optionale Metadaten (Bildungsstufen, Fachgebiete, Zielgruppen) festzulegen.";
    }
    if (!state.freigegeben) {
      return "Präsentiere eine Zusammenfassung aller Eingaben und bitte direkt um Freigabe.";
    }
    return "Konfiguration ist abgeschlossen und freigegeben.";
  }

  /**
   * Validiert den vom Parser extrahierten Formularstand.
   * Prüft alle Felder auf Gültigkeit und Typkonformität.
   * @private
   * @param {any} parsed - Die geparsten Daten
   * @returns {FormState | null} Der validierte Formularstand oder null
   */
  private validateParsedState(parsed: any): FormState | null {
    if (!parsed || typeof parsed !== 'object') return null;

    const currentState = this.formGroup.value;

    return {
      themenbaumthema: parsed.themenbaumthema ?? currentState.themenbaumthema,
      hauptkategorien: this.validateNumber(parsed.hauptkategorien, 1, 30) ?? currentState.hauptkategorien,
      unterkategorien: this.validateNumber(parsed.unterkategorien, 0, 20) ?? currentState.unterkategorien,
      weitereUnterkategorien: this.validateNumber(parsed.weitereUnterkategorien, 0, 20) ?? currentState.weitereUnterkategorien,
      bildungsstufen: this.validateArray(parsed.bildungsstufen, this.bildungsstufen) || currentState.bildungsstufen,
      fachgebiete: this.validateArray(parsed.fachgebiete, this.fachgebiete) || currentState.fachgebiete,
      zielgruppen: this.validateArray(parsed.zielgruppen, this.zielgruppen) || currentState.zielgruppen,
      freigegeben: this.extractFreigabe(parsed) ?? currentState.freigegeben
    };
  }

  /**
   * Extrahiert den Freigabe-Status aus der geparsten Antwort.
   * Erkennt verschiedene positive Bestätigungen.
   * @private
   * @param {any} parsed - Die geparsten Daten
   * @returns {boolean} True wenn freigegeben, sonst false
   */
  private extractFreigabe(parsed: any): boolean {
    if (typeof parsed?.freigegeben === 'boolean') {
      return parsed.freigegeben;
    }

    const positiveAnswers = [
      'ja', 'yes', 'ok', 'okay', 'stimmt', 'korrekt',
      'passt', 'passt so', 'einverstanden', 'freigeben',
      'bestätigt', 'bestätige', 'bestätigen', 'bestätige ich',
      'alles korrekt', 'sieht gut aus', 'kann freigegeben werden'
    ];

    for (const answer of positiveAnswers) {
      if (parsed?.content?.toLowerCase().includes(answer)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Initialisiert das Reaktive Formular mit allen Feldern.
   * Setzt die Validierung und Wertüberwachung auf.
   * @private
   */
  private initForm(): void {
    this.formGroup = this.formBuilder.group({
      themenbaumthema: [null],
      hauptkategorien: [null],
      unterkategorien: [null],
      weitereUnterkategorien: [null],
      bildungsstufen: [[]],
      fachgebiete: [[]],
      zielgruppen: [[]],
      freigegeben: [false]
    });

    // Überwache Änderungen am Formular
    this.formGroup.valueChanges.subscribe((value: FormState) => {
      if (value.freigegeben && !this.previousState?.freigegeben) {
        this.simulateThemenbaumGeneration();
      }
      this.previousState = value;
    });
  }

  /**
   * Simuliert einen API-Aufruf zur Themenbaumgenerierung.
   * Erstellt einen strukturierten Request und zeigt die simulierte Response.
   * @private
   */
  private simulateThemenbaumGeneration(): void {
    const state = this.formGroup.value;

    // Mappings für die API anwenden
    const apiRequest = {
      topic: state.themenbaumthema,
      mainCategories: state.hauptkategorien,
      subCategories: state.unterkategorien,
      furtherSubCategories: state.weitereUnterkategorien,
      educationalContexts: state.bildungsstufen.map((label: string) => EDUCATIONAL_CONTEXT_MAPPING[label] || ''),
      disciplines: state.fachgebiete.map((label: string) => DISCIPLINE_MAPPING[label] || ''),
      targetGroups: state.zielgruppen.map((label: string) => TARGET_GROUP_MAPPING[label] || '')
    };

    // Zeige API-Request an
    this.addBotMessage(`
# Themenbaum wird generiert 🚀

Ich starte jetzt die Generierung des Themenbaums mit folgenden Parametern:

- **Thema**: ${state.themenbaumthema}
- **Hauptkategorien**: \`${state.hauptkategorien}\`
- **Unterkategorien**: \`${state.unterkategorien}\`
- **Weitere Unterkategorien**: \`${state.weitereUnterkategorien}\`
${state.bildungsstufen.length > 0 ? `- **Bildungsstufen**: ${state.bildungsstufen.join(', ')}` : ''}
${state.fachgebiete.length > 0 ? `- **Fachgebiete**: ${state.fachgebiete.join(', ')}` : ''}
${state.zielgruppen.length > 0 ? `- **Zielgruppen**: ${state.zielgruppen.join(', ')}` : ''}

*Sende API-Request an \`POST /api/v1/topic-trees/generate\`:*
\`\`\`json
${JSON.stringify(apiRequest, null, 2)}
\`\`\`

*Bitte warte einen Moment, während ich den Themenbaum generiere...*
`);

    // Simuliere API-Aufruf nach 2 Sekunden
    setTimeout(() => {
      const apiResponse = {
        id: crypto.randomUUID(),
        status: 'success',
        data: {
          ...apiRequest,
          createdAt: new Date().toISOString(),
          uri: `/topic-trees/generated/${crypto.randomUUID()}`
        }
      };

      this.addBotMessage(`
# Themenbaum erfolgreich generiert! ✅

*API-Response von \`POST /api/v1/topic-trees/generate\`:*
\`\`\`json
${JSON.stringify(apiResponse, null, 2)}
\`\`\`

Der Themenbaum wurde erfolgreich generiert und ist unter der URI \`${apiResponse.data.uri}\` verfügbar.

Du kannst jetzt:
1. Einen neuen Themenbaum erstellen
2. Den generierten Themenbaum in der Übersicht ansehen
3. Die Konfiguration bearbeiten

Was möchtest du tun?`);
    }, 2000);
  }

  /**
   * Validiert einen String-Wert auf Gültigkeit.
   * @private
   * @param {any} value - Der zu validierende Wert
   * @returns {string | null} Der validierte String oder null
   */
  private validateString(value: any): string | null {
    if (typeof value === 'string') {
      const cleaned = value.trim();
      return cleaned || null;
    }
    return null;
  }

  /**
   * Validiert einen numerischen Wert innerhalb definierter Grenzen.
   * @private
   * @param {any} value - Der zu validierende Wert
   * @param {number} min - Minimaler erlaubter Wert
   * @param {number} max - Maximaler erlaubter Wert
   * @returns {number | null} Die validierte Zahl oder null
   */
  private validateNumber(value: any, min: number, max: number): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (!isNaN(num) && num >= min && num <= max) {
      return num;
    }
    return null;
  }

  /**
   * Validiert ein Array gegen eine Liste erlaubter Werte.
   * @private
   * @param {any} value - Das zu validierende Array
   * @param {string[]} allowedValues - Liste der erlaubten Werte
   * @returns {string[] | null} Das validierte Array oder null
   */
  private validateArray(value: any, allowedValues: string[]): string[] | null {
    if (!Array.isArray(value)) return null;
    const validValues = value
      .filter((v): v is string => typeof v === 'string')
      .map(v => v.trim())
      .filter(v => v && allowedValues.includes(v));
    return validValues.length > 0 ? validValues : null;
  }

  /**
   * Aktualisiert den Formularstand mit neuen Werten.
   * Berücksichtigt nur gültige Änderungen.
   * @private
   * @param {FormState} state - Der neue Formularstand
   */
  private updateFormState(state: FormState) {
    // Erstelle ein Update-Objekt mit allen gültigen Werten
    const update: Partial<FormState> = {};

    // Überprüfe und aktualisiere jedes Feld einzeln
    if (state.themenbaumthema) {
      update.themenbaumthema = state.themenbaumthema;
    }

    if (state.hauptkategorien !== null && state.hauptkategorien !== undefined) {
      update.hauptkategorien = state.hauptkategorien;
    }

    if (state.unterkategorien !== null && state.unterkategorien !== undefined) {
      update.unterkategorien = state.unterkategorien;
    }

    if (state.weitereUnterkategorien !== null && state.weitereUnterkategorien !== undefined) {
      update.weitereUnterkategorien = state.weitereUnterkategorien;
    }

    if (Array.isArray(state.bildungsstufen)) {
      update.bildungsstufen = state.bildungsstufen;
    }

    if (Array.isArray(state.fachgebiete)) {
      update.fachgebiete = state.fachgebiete;
    }

    if (Array.isArray(state.zielgruppen)) {
      update.zielgruppen = state.zielgruppen;
    }

    if (typeof state.freigegeben === 'boolean') {
      update.freigegeben = state.freigegeben;
    }

    // Aktualisiere das Formular mit den neuen Werten
    this.formGroup.patchValue(update, { emitEvent: true });

    // Markiere die Felder als "touched" und "dirty"
    Object.keys(update).forEach(key => {
      const control = this.formGroup.get(key);
      if (control) {
        control.markAsTouched();
        control.markAsDirty();
      }
    });

    // Trigger Change Detection
    this.formGroup.updateValueAndValidity();
  }

  /**
   * Fügt eine neue Benutzernachricht zum Chat hinzu.
   * @private
   * @param {string} content - Der Nachrichteninhalt
   */
  private addUserMessage(content: string) {
    this.messages.push({ sender: 'user', content });
    this.shouldScroll = true;
  }

  /**
   * Fügt eine neue Bot-Nachricht zum Chat hinzu.
   * @private
   * @param {string} content - Der Nachrichteninhalt
   */
  private addBotMessage(content: string) {
    this.messages.push({ sender: 'bot', content });
    this.shouldScroll = true;
  }

  /**
   * Verarbeitet Änderungen in den Select-Feldern.
   * Aktualisiert die entsprechenden Arrays im Formular.
   * @param {string} field - Name des geänderten Feldes
   * @param {MatSelectChange} event - Das Change-Event
   */
  onSelectChange(field: string, event: MatSelectChange) {
    if (!event.value) return;
    
    const currentValues = this.formGroup.get(field)?.value || [];
    if (!currentValues.includes(event.value)) {
      this.formGroup.patchValue({
        [field]: [...currentValues, event.value]
      });
    }
    
    // Reset the select
    if (field === 'bildungsstufen') {
      event.source.value = '';
    } else if (field === 'fachgebiete') {
      event.source.value = '';
    } else if (field === 'zielgruppen') {
      event.source.value = '';
    }
  }

  /**
   * Entfernt einen Wert aus einem Array-Feld des Formulars.
   * @param {string} field - Name des Feldes
   * @param {string} value - Zu entfernender Wert
   */
  removeValue(field: string, value: string) {
    const currentValues = this.formGroup.get(field)?.value || [];
    this.formGroup.patchValue({
      [field]: currentValues.filter((v: string) => v !== value)
    });
  }

  /**
   * Verarbeitet das Absenden einer Nachricht.
   * Leert das Eingabefeld nach dem Senden.
   */
  sendMessage() {
    if (this.userInput.trim()) {
      this.addUserMessage(this.userInput);
      this.processUserInput(this.userInput);
      this.userInput = '';
    }
  }

  /**
   * Formatiert eine Nachricht mit Markdown-Unterstützung.
   * Konvertiert Markdown-Syntax in sicheres HTML.
   * @param {string} content - Der zu formatierende Inhalt
   * @returns {SafeHtml} Der formatierte HTML-String
   */
  formatMessage(content: string): SafeHtml {
    // Einfache Markdown-Formatierung
    let html = content
      // Code-Blöcke
      .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
      // Inline-Code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Überschriften
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Listen
      .replace(/^\* (.*$)/gm, '<li>$1</li>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^(\d+\.) (.*$)/gm, '<li>$2</li>')
      // Fett und Kursiv
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Zeilenumbrüche
      .replace(/\n/g, '<br>');

    // Listen-Container hinzufügen
    if (html.includes('<li>')) {
      html = '<ul>' + html + '</ul>';
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * Prüft, ob alle Pflichtfelder ausgefüllt sind.
   * @returns {boolean} True wenn vollständig, sonst false
   */
  isFormComplete(): boolean {
    const state = this.formGroup.value;
    return !!(state.themenbaumthema && 
              state.hauptkategorien !== null && 
              state.unterkategorien !== null && 
              state.weitereUnterkategorien !== null);
  }

  /**
   * Berechnet den Fortschritt der Formularausfüllung.
   * @returns {number} Prozentwert zwischen 0 und 100
   */
  getProgressValue(): number {
    const requiredFields = ['themenbaumthema', 'hauptkategorien'];
    const filledFields = requiredFields.filter(field => {
      const value = this.formGroup.get(field)?.value;
      return value !== null && value !== '' && value !== undefined;
    });
    return (filledFields.length / requiredFields.length) * 100;
  }

  /**
   * Ermittelt den aktuellen Status-Text.
   * @returns {string} Der Status als Text
   */
  getStatusText(): string {
    if (this.formGroup.get('freigegeben')?.value) {
      return 'Themenbaum ist freigegeben';
    }
    if (this.isFormComplete()) {
      return 'Mindestangaben sind erfüllt';
    }
    return 'Bitte Mindestangaben ausfüllen';
  }

  /**
   * Ermittelt die Status-Farbe für Material Design.
   * @returns {string} Der Material-Farb-Identifier
   */
  getStatusColor(): string {
    if (this.formGroup.get('freigegeben')?.value) {
      return 'primary';
    }
    if (this.isFormComplete()) {
      return 'accent';
    }
    return 'warn';
  }

  /**
   * Ermittelt das passende Status-Icon.
   * @returns {string} Der Material-Icon-Name
   */
  getStatusIcon(): string {
    if (this.formGroup.get('freigegeben')?.value) {
      return 'check_circle';
    }
    if (this.isFormComplete()) {
      return 'check_circle';
    }
    return 'info';
  }

  /**
   * Ermittelt den erweiterten Status-Text.
   * @returns {string} Der detaillierte Status
   */
  getStatusTextNew(): string {
    if (this.formGroup.get('freigegeben')?.value) {
      return 'Themenbaum freigegeben';
    }
    if (this.isFormComplete()) {
      return 'Alle Mindestangaben erfüllt - Bereit zur Freigabe';
    }
    return 'Bitte füllen Sie die Mindestangaben aus';
  }
}
