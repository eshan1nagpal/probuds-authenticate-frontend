import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
@Component({
  selector: 'app-admin-pager', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav class="pager" aria-label="Results pagination"><span>{{ total() }} {{ total() === 1 ? 'result' : 'results' }} · Page {{ page() + 1 }} of {{ pages() }}</span>
    <div><label>Rows <select [value]="size()" (change)="resize($event)" [disabled]="busy()"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
    <button type="button" class="btn btn-outline-primary" (click)="change.emit({page: page()-1, size: size()})" [disabled]="busy() || page() === 0">Previous</button>
    <button type="button" class="btn btn-outline-primary" (click)="change.emit({page: page()+1, size: size()})" [disabled]="busy() || page()+1 >= pages()">Next</button></div></nav>`,
  styles: `.pager{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:18px 22px;border-top:1px solid #e8edf3;color:var(--muted);font-size:.8rem;flex-wrap:wrap}.pager div{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pager .btn{font-size:.8rem}.pager select{margin-left:6px;padding:5px;border:1px solid #d5dfe9;border-radius:6px}`,
})
export class AdminPager {
  readonly total = input(0); readonly page = input(0); readonly size = input(10); readonly busy = input(false);
  readonly change = output<{ page: number; size: number }>(); readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  resize(event: Event): void { this.change.emit({ page: 0, size: Number((event.target as HTMLSelectElement).value) }); }
}
