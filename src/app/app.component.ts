import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin, retry, finalize } from 'rxjs';

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
                @for (row of table; track row.player; let i = $index) {
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
              @for (fixture of fixtures; track fixture.homePlayer) {
                <article>
                  <span>{{ fixture.homePlayer }}</span>
                  <strong>
                    {{ fixture.homePoints ?? '–' }}
                    :
                    {{ fixture.awayPoints ?? '–' }}
                  </strong>
                  <span>{{ fixture.awayPlayer }}</span>
                </article>
              }
            </div>

            <p class="hint">
              Wird nach dem Punktimport dienstags um 10:00 Uhr aktualisiert.
            </p>
          </section>
        </div>
      }
    </main>
  `
})
export class AppComponent {

  private http = inject(HttpClient);

  days = Array.from({ length: 34 }, (_, i) => i + 1);

  matchday = 1;

  table: TableRow[] = [];
  fixtures: Fixture[] = [];

  loading = false;
  error: string | null = null;

  constructor() {
    this.load();
  }

  selectDay(day: string) {
    this.matchday = Number(day);
    this.loadFixtures();
  }

  load() {
    this.loading = true;
    this.error = null;

    forkJoin({
      table: this.http
          .get<TableRow[]>('/api/table')
          .pipe(retry({ count: 5, delay: 3000 })),

      fixtures: this.http
          .get<Fixture[]>(`/api/matchdays/${this.matchday}`)
          .pipe(retry({ count: 5, delay: 3000 }))
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
        .get<Fixture[]>(`/api/matchdays/${this.matchday}`)
        .pipe(retry({ count: 5, delay: 3000 }))
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
}
