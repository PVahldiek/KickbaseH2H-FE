import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, finalize, retry } from 'rxjs';

type TableRow = {
  player: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
};

type Fixture = {
  matchday: number;
  homePlayer: string;
  awayPlayer: string;
  homePoints: number | null;
  awayPoints: number | null;
  h2hAvailable: boolean;
};

type H2hPlayerStats = {
  player: string;
  position: number;
  average: number;
  recentAverage: number;
  min: number;
  max: number;
  form: string[];
};

type H2hPrediction = {
  home: number;
  away: number;
};

type H2hResponse = {
  matchday: number;
  homePlayer: string;
  awayPlayer: string;
  home: H2hPlayerStats;
  away: H2hPlayerStats;
  prediction: H2hPrediction;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main>
      <header>
        <p class="eyebrow">KICKBASE ENGELTHAL</p>
        <h1>Head to Head</h1>
        <p>Saison 26/27</p>
      </header>

      @if (loading) {
        <section class="loading">
          <div class="spinner"></div>
          <h2>Daten werden geladen...</h2>
          <p>
            Der Server wird gestartet und die aktuellen Daten werden geladen.
          </p>
        </section>
      }

      @if (error) {
        <section class="error">
          <h2>Daten konnten nicht geladen werden</h2>
          <p>{{ error }}</p>
          <button (click)="load()">Erneut versuchen</button>
        </section>
      }

      @if (!loading && !error) {
        <section class="toolbar">
          <label>
            Spieltag
            <select
                (change)="selectDay($any($event.target).value)"
                [value]="matchday"
            >
              @for (day of days; track day) {
                <option [value]="day">{{ day }}</option>
              }
            </select>
          </label>
        </section>

        <div class="grid">
          <section class="card">
            <h2>Tabelle</h2>

            <table>
              <thead>
              <tr>
                <th>#</th>
                <th>Spieler</th>
                <th>Sp</th>
                <th>S</th>
                <th>U</th>
                <th>N</th>
                <th>Pkt</th>
              </tr>
              </thead>

              <tbody>
                @for (
                        row of table;
                    track row.player;
                    let i = $index
                    ) {
                  <tr>
                    <td>{{ i + 1 }}</td>
                    <td>{{ row.player }}</td>
                    <td>{{ row.played }}</td>
                    <td>{{ row.wins }}</td>
                    <td>{{ row.draws }}</td>
                    <td>{{ row.losses }}</td>
                    <td class="points">{{ row.points }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>

          <section class="card">
            <h2>Duelle · Spieltag {{ matchday }}</h2>

            <div class="fixtures">
              @for (
                      fixture of fixtures;
                  track fixture.homePlayer
                  ) {

                @if (fixture.h2hAvailable) {
                  <button
                      class="fixture-row clickable"
                      type="button"
                      (click)="openH2h(fixture)"
                  >
                    <span>{{ fixture.homePlayer }}</span>

                    <strong>
                      {{ fixture.homePoints ?? '–' }}
                      :
                      {{ fixture.awayPoints ?? '–' }}
                    </strong>

                    <span>{{ fixture.awayPlayer }}</span>

                    <span class="fixture-arrow">›</span>
                  </button>
                } @else if (isFuture(fixture)) {
                  <button
                      class="fixture-row clickable"
                      type="button"
                      (click)="openUnavailable(fixture)"
                  >
                    <span>{{ fixture.homePlayer }}</span>

                    <strong>
                      {{ fixture.homePoints ?? '–' }}
                      :
                      {{ fixture.awayPoints ?? '–' }}
                    </strong>

                    <span>{{ fixture.awayPlayer }}</span>

                    <span class="fixture-arrow">›</span>
                  </button>
                } @else {
                  <article class="fixture-row">
                    <span>{{ fixture.homePlayer }}</span>

                    <strong>
                      {{ fixture.homePoints ?? '–' }}
                      :
                      {{ fixture.awayPoints ?? '–' }}
                    </strong>

                    <span>{{ fixture.awayPlayer }}</span>
                  </article>
                }
              }
            </div>

            @if (isSelectedMatchdayActive()) {
              <p class="hint">
                Kommende Duelle anklicken für Matchday H2H Infos.
              </p>
            } @else if (isSelectedMatchdayFuture()) {
              <p class="hint">
                Stats für zukünftige Spieltage sind noch nicht verfügbar.
              </p>
            } @else {
              <p class="hint">
                Die H2H-Infos sind für diesen Spieltag bereits geschlossen.
              </p>
            }
          </section>
        </div>
      }
    </main>

    @if (selectedFixture) {
      <div
          class="modal-backdrop"
          (click)="closeH2h()"
      >
        <section
            class="h2h-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="h2h-title"
            (click)="$event.stopPropagation()"
        >
          <button
              class="modal-close"
              type="button"
              aria-label="Schließen"
              (click)="closeH2h()"
          >
            ×
          </button>

          <div class="modal-header">
            <p class="modal-eyebrow">
              MATCHDAY {{ selectedFixture.matchday }}
            </p>

            <h2 id="h2h-title">Matchday H2H Infos</h2>

            <div class="matchup">
              <span>{{ selectedFixture.homePlayer }}</span>

              <strong>VS</strong>

              <span>{{ selectedFixture.awayPlayer }}</span>
            </div>
          </div>

          @if (h2hLoading) {
            <div class="modal-loading">
              <div class="spinner"></div>
              <p>Spieler-Statistiken werden geladen...</p>
            </div>
          }

          @if (h2hError) {
            <div class="modal-error">
              <p>{{ h2hError }}</p>

              <button
                  type="button"
                  (click)="loadH2h()"
              >
                Erneut versuchen
              </button>
            </div>
          }

          @if (
              h2hStats &&
              !h2hLoading &&
              !h2hError
              ) {
            <div class="prediction">
              <div class="prediction-heading">
                <span>Prognose</span>

                <strong>
                  {{ h2hStats.prediction.home }}%
                  <small>vs</small>
                  {{ h2hStats.prediction.away }}%
                </strong>
              </div>

              <div class="prediction-bar">
                <div
                    class="prediction-home"
                    [style.width.%]="
                    h2hStats.prediction.home
                  "
                ></div>

                <div
                    class="prediction-away"
                    [style.width.%]="
                    h2hStats.prediction.away
                  "
                ></div>
              </div>

              <div class="prediction-names">
                <span>{{ h2hStats.homePlayer }}</span>
                <span>{{ h2hStats.awayPlayer }}</span>
              </div>
            </div>

            <div class="player-columns">
              <section class="player-panel">
                <h3>{{ h2hStats.home.player }}</h3>

                <div class="position">
                  <span>Aktuelle Position</span>

                  <strong>
                    {{ h2hStats.home.position || '–' }}.
                  </strong>
                </div>

                <div class="form-section">
                  <span>Form</span>

                  <div class="form">
                    @if (
                        h2hStats.home.form.length === 0
                        ) {
                      <em>Noch keine Spiele</em>
                    }

                    @for (
                            result of h2hStats.home.form;
                        track $index
                        ) {
                      <span
                          class="form-result"
                          [class.win]="result === 'W'"
                          [class.draw]="result === 'U'"
                          [class.loss]="result === 'N'"
                      >
                        {{ result }}
                      </span>
                    }
                  </div>
                </div>

                <div class="stats-grid">
                  <div>
                    <span>Ø Punkte</span>

                    <strong>
                      {{
                        h2hStats.home.average
                            | number:'1.1-1'
                      }}
                    </strong>
                  </div>

                  <div>
                    <span>Ø letzte 5</span>

                    <strong>
                      {{
                        h2hStats.home.recentAverage
                            | number:'1.1-1'
                      }}
                    </strong>
                  </div>

                  <div>
                    <span>Min</span>
                    <strong>{{ h2hStats.home.min }}</strong>
                  </div>

                  <div>
                    <span>Max</span>
                    <strong>{{ h2hStats.home.max }}</strong>
                  </div>
                </div>
              </section>

              <section class="player-panel">
                <h3>{{ h2hStats.away.player }}</h3>

                <div class="position">
                  <span>Aktuelle Position</span>

                  <strong>
                    {{ h2hStats.away.position || '–' }}.
                  </strong>
                </div>

                <div class="form-section">
                  <span>Form</span>

                  <div class="form">
                    @if (
                        h2hStats.away.form.length === 0
                        ) {
                      <em>Noch keine Spiele</em>
                    }

                    @for (
                            result of h2hStats.away.form;
                        track $index
                        ) {
                      <span
                          class="form-result"
                          [class.win]="result === 'W'"
                          [class.draw]="result === 'U'"
                          [class.loss]="result === 'N'"
                      >
                        {{ result }}
                      </span>
                    }
                  </div>
                </div>

                <div class="stats-grid">
                  <div>
                    <span>Ø Punkte</span>

                    <strong>
                      {{
                        h2hStats.away.average
                            | number:'1.1-1'
                      }}
                    </strong>
                  </div>

                  <div>
                    <span>Ø letzte 5</span>

                    <strong>
                      {{
                        h2hStats.away.recentAverage
                            | number:'1.1-1'
                      }}
                    </strong>
                  </div>

                  <div>
                    <span>Min</span>
                    <strong>{{ h2hStats.away.min }}</strong>
                  </div>

                  <div>
                    <span>Max</span>
                    <strong>{{ h2hStats.away.max }}</strong>
                  </div>
                </div>
              </section>
            </div>

            <p class="modal-footnote">
              Die Prognose basiert auf aktueller Form,
              Saison-Durchschnitt und Tabellenposition.
            </p>
          }
        </section>
      </div>
    }

    @if (unavailableFixture) {
      <div
          class="modal-backdrop"
          (click)="closeUnavailable()"
      >
        <section
            class="h2h-modal unavailable-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unavailable-title"
            (click)="$event.stopPropagation()"
        >
          <button
              class="modal-close"
              type="button"
              aria-label="Schließen"
              (click)="closeUnavailable()"
          >
            ×
          </button>

          <div class="modal-header">
            <p class="modal-eyebrow">
              MATCHDAY {{ unavailableFixture.matchday }}
            </p>

            <h2 id="unavailable-title">
              Stats noch nicht verfügbar
            </h2>

            <div class="matchup">
              <span>
                {{ unavailableFixture.homePlayer }}
              </span>

              <strong>VS</strong>

              <span>
                {{ unavailableFixture.awayPlayer }}
              </span>
            </div>
          </div>

          <div class="unavailable-content">
            <div class="unavailable-icon">
              ⏳
            </div>

            <h3>
              Komm später wieder
            </h3>

            <p>
              Die Matchday-Stats für diesen Spieltag
              sind noch nicht verfügbar.
            </p>

            <p>
              Sobald dieser Spieltag an der Reihe ist,
              kannst du hier Form, Statistiken und
              Prognose der beiden Spieler sehen.
            </p>

            <button
                type="button"
                class="unavailable-button"
                (click)="closeUnavailable()"
            >
              Verstanden
            </button>
          </div>
        </section>
      </div>
    }
  `
})
export class AppComponent {

  private http = inject(HttpClient);

  days = Array.from(
      { length: 34 },
      (_, i) => i + 1
  );

  matchday = 1;

  table: TableRow[] = [];
  fixtures: Fixture[] = [];

  loading = false;
  error: string | null = null;

  selectedFixture: Fixture | null = null;

  h2hStats: H2hResponse | null = null;
  h2hLoading = false;
  h2hError: string | null = null;

  unavailableFixture: Fixture | null = null;

  constructor() {
    this.load();
  }

  selectDay(day: string) {
    this.closeH2h();
    this.closeUnavailable();

    this.matchday = Number(day);

    this.loadFixtures();
  }

  load() {
    this.loading = true;
    this.error = null;

    forkJoin({
      table: this.http
          .get<TableRow[]>('/api/table')
          .pipe(
              retry({
                count: 5,
                delay: 3000
              })
          ),

      fixtures: this.http
          .get<Fixture[]>(
              `/api/matchdays/${this.matchday}`
          )
          .pipe(
              retry({
                count: 5,
                delay: 3000
              })
          )
    })
        .pipe(
            finalize(() => {
              this.loading = false;
            })
        )
        .subscribe({
          next: ({ table, fixtures }) => {
            this.table = table;
            this.fixtures = fixtures;
          },

          error: () => {
            this.error =
                'Der Server konnte nicht erreicht werden. Bitte versuche es erneut.';
          }
        });
  }

  private loadFixtures() {
    this.http
        .get<Fixture[]>(
            `/api/matchdays/${this.matchday}`
        )
        .pipe(
            retry({
              count: 5,
              delay: 3000
            })
        )
        .subscribe({
          next: value => {
            this.fixtures = value;
          },

          error: () => {
            this.error =
                'Die Duelle konnten nicht geladen werden.';
          }
        });
  }

  /**
   * Returns true when the fixture belongs to the next/current
   * matchday and H2H statistics are available.
   */
  isUpcoming(fixture: Fixture): boolean {
    return fixture.h2hAvailable;
  }

  /**
   * Returns true when a fixture is from a future matchday.
   *
   * Since h2hAvailable is provided by the backend, a matchday
   * is considered future when it is incomplete but H2H is not
   * available for it.
   */
  isFuture(fixture: Fixture): boolean {
    return (
        !fixture.h2hAvailable
        &&
        (
            fixture.homePoints === null
            ||
            fixture.awayPoints === null
        )
    );
  }

  /**
   * Opens the real H2H statistics modal.
   */
  openH2h(fixture: Fixture) {

    if (!fixture.h2hAvailable) {
      this.openUnavailable(fixture);
      return;
    }

    this.unavailableFixture = null;

    this.selectedFixture = fixture;
    this.h2hStats = null;
    this.h2hError = null;

    this.loadH2h();
  }

  /**
   * Opens the "stats not available yet" overlay.
   */
  openUnavailable(fixture: Fixture) {

    this.selectedFixture = null;
    this.h2hStats = null;
    this.h2hError = null;

    this.unavailableFixture = fixture;
  }

  loadH2h() {

    if (!this.selectedFixture) {
      return;
    }

    /*
     * Additional frontend protection.
     * The backend also enforces this rule.
     */
    if (!this.selectedFixture.h2hAvailable) {
      this.openUnavailable(this.selectedFixture);
      return;
    }

    this.h2hLoading = true;
    this.h2hError = null;

    const params = new HttpParams()
        .set(
            'homePlayer',
            this.selectedFixture.homePlayer
        )
        .set(
            'awayPlayer',
            this.selectedFixture.awayPlayer
        );

    this.http
        .get<H2hResponse>(
            `/api/h2h/${this.selectedFixture.matchday}`,
            { params }
        )
        .pipe(
            retry({
              count: 2,
              delay: 1500
            }),
            finalize(() => {
              this.h2hLoading = false;
            })
        )
        .subscribe({
          next: value => {
            this.h2hStats = value;
          },

          error: error => {

            if (error?.status === 403) {
              this.h2hError =
                  'Die H2H-Informationen sind nur für den kommenden Spieltag verfügbar.';
            } else {
              this.h2hError =
                  'Die H2H-Informationen konnten nicht geladen werden.';
            }
          }
        });
  }

  closeH2h() {
    this.selectedFixture = null;
    this.h2hStats = null;
    this.h2hError = null;
    this.h2hLoading = false;
  }

  closeUnavailable() {
    this.unavailableFixture = null;
  }

  /**
   * Returns true when the currently selected matchday contains
   * an H2H-enabled fixture.
   */
  isSelectedMatchdayActive(): boolean {
    return this.fixtures.some(
        fixture => fixture.h2hAvailable
    );
  }

  /**
   * Returns true when the currently selected matchday contains
   * future fixtures but is not the active matchday.
   */
  isSelectedMatchdayFuture(): boolean {
    return (
        !this.isSelectedMatchdayActive()
        &&
        this.fixtures.some(
            fixture => this.isFuture(fixture)
        )
    );
  }

  @HostListener('document:keydown.escape')
  onEscape() {

    if (this.selectedFixture) {
      this.closeH2h();
    }

    if (this.unavailableFixture) {
      this.closeUnavailable();
    }
  }
}