/* Ardot 导入专用：把 DOM 里的 <br> 转成独立块级节点。
 * Ardot html_to_ardot 会丢失 <br> 的换行语义，导致多行文本重叠
 * （画板头部 meta、项目符号列表、ring-meta 说明均受此影响）。
 * 只在预渲染 Ardot 导入产物时调用；浏览器端 screens 保持 <br> 不变。
 * 幂等：无 <br> 时不做任何事。
 */
function convertBreaks(doc, root){
  if(!root) return;
  var brs = Array.prototype.slice.call(root.querySelectorAll('br'));
  if(!brs.length) return;
  var parents = [], seen = [];
  brs.forEach(function(b){
    var p = b.parentNode;
    if(p && seen.indexOf(p) < 0){ seen.push(p); parents.push(p); }
  });
  parents.forEach(function(parent){
    var nodes = Array.prototype.slice.call(parent.childNodes);
    var hasBr = nodes.some(function(n){ return n.nodeType===1 && n.tagName==='BR'; });
    if(!hasBr) return;
    var groups = [], cur = [];
    nodes.forEach(function(n){
      if(n.nodeType===1 && n.tagName==='BR'){ groups.push(cur); cur=[]; }
      else cur.push(n);
    });
    groups.push(cur);
    while(parent.firstChild) parent.removeChild(parent.firstChild);
    groups.forEach(function(g){
      var div = doc.createElement('div');
      var hasContent = g.some(function(n){
        return (n.nodeType===1) || (n.nodeType===3 && n.textContent.trim()!=='');
      });
      div.className = hasContent ? 'brk-li' : 'brk-sp';
      if(hasContent){ g.forEach(function(n){ div.appendChild(n); }); }
      parent.appendChild(div);
    });
  });
}
module.exports = { convertBreaks: convertBreaks };
