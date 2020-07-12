const cheerio = require('cheerio'); // 解析器
const axios = require('./axios'); // 数据请求
const { hashNameIntoInt, hasLetter } = require('./utils');
const scrapeWorkMetadataFromHVDB = require('./hvdb');

/**
 * Scrapes static work metadata from public DLsite page HTML.
 * @param {number} id Work id.
 * @param {String} language 标签语言，'ja-jp', 'zh-tw' or 'zh-cn'，默认'zh-cn'
 */
const scrapeWorkStaticMetadata = async (id, language) => {
  const rjcode = (`000000${id}`).slice(-6);
  const url = `https://www.dlsite.com/maniax/work/=/product_id/RJ${rjcode}.html`;

  let COOKIE_LOCALE, AGE_RATINGS, GENRE, VA, RELEASE, SERIES, WORK_FORMAT;
  switch (language) {
    case 'ja-jp':
      COOKIE_LOCALE = 'locale=ja-jp'
      AGE_RATINGS = '年齢指定';
      GENRE = 'ジャンル';
      VA = '声優';
      RELEASE = '販売日';
      SERIES = 'シリーズ名';
      WORK_FORMAT = '作品形式';
      break;
    case 'zh-tw':
      COOKIE_LOCALE = 'locale=zh-tw'
      AGE_RATINGS = '年齡指定';
      GENRE = '分類';
      VA = '聲優';
      RELEASE = '販賣日';
      SERIES = '系列名';
      WORK_FORMAT = '作品形式';
      break;
    default:
      COOKIE_LOCALE = 'locale=zh-cn'
      AGE_RATINGS = '年龄指定';
      GENRE = '分类';
      VA = '声优';
      RELEASE = '贩卖日';
      SERIES = '系列名';
      WORK_FORMAT = '作品类型';
  }

  // 请求网页
  let res = null;
  try {
    res = await axios.retryGet(url, {
      retry: {},
      headers: { "cookie": COOKIE_LOCALE } // 自定义请求头
    });
  } catch (err) {
    if (err.response) {
      // 请求已发出，但服务器响应的状态码不在 2xx 范围内
      throw new Error(`Couldn't request work page HTML (${url}), received: ${err.response.status}.`);
    } else {
      throw err;
    }
  }

  // 解析 html
  const work = {
    id,
    title: null,
    circle: null,
    age_ratings: null,
    release: null,
    series: null,
    tags: [],
    vas: []
  };
  try {
    // 转换成 jQuery 对象
    const $ = cheerio.load(res.data);

    // 作品类型	
    const workFormatElement = $('#work_outline').children('tbody').children('tr').children('th')
      .filter(function() {
        return $(this).text() === WORK_FORMAT;
      }).parent().children('td');
   
    const workFormatText = workFormatElement.text();
    if (workFormatText) {
      switch (language) {
        case 'ja-jp':
          if (workFormatText.indexOf('ボイス・ASMR') === -1) {
            throw new Error(`[RJ${rjcode}] 不是音声类型的作品.`);
          }
          break;
        case 'zh-tw':
          if (workFormatText.indexOf('聲音作品・ASMR') === -1) {
            throw new Error(`[RJ${rjcode}] 不是音声类型的作品.`);
          }
          break;
        default:
          if (workFormatText.indexOf('音声・ASMR') === -1) {
            throw new Error(`[RJ${rjcode}] 不是音声类型的作品.`);
          }
      }
    } else {
      throw new Error('解析[作品类型]失败.');
    }

    // // 作品类型
    // const workFormatElements = $('#work_outline').children('tbody').children('tr').children('th')
    //   .filter(function() {
    //     return $(this).text() === WORK_FORMAT;
    //   }).parent().children('td').children('div').children('a');
    // if (!workFormatElements.length) {
    //   throw new Error('解析[作品类型]失败.');
    // }
    // const SOUElement = workFormatElements.filter(function() {
    //   const tagUrl = $(this).attr('href');
    //   return tagUrl && tagUrl.indexOf('SOU') !== -1;
    // });
    // if (SOUElement.length === 0) {
    //   throw new Error(`[RJ${rjcode}] 不是音声类型的作品.`);
    // }

    // 标题
    const titleElement = $(`a[href="${url}"]`);
    const titleText = titleElement.text();
    if (titleText) {
      work.title = titleText;
    } else {
      throw new Error('解析[标题]失败.');
    }
    
    // 社团
    const circleElement = $('span[class="maker_name"]').children('a');
    const circleUrl = circleElement.attr('href');
    const circleName = circleElement.text();
    const circleId = circleUrl && circleUrl.match(/RG(\d{5})/) && parseInt(circleUrl.match(/RG(\d{5})/)[1]);
    if (circleId && circleName) {
      work.circle = {
        id: circleId,
        name: circleName
      };
    } else {
      throw new Error('解析[社团]失败.');
    }

    // 年龄指定
    const ageRatingsElement = $('#work_outline').children('tbody').children('tr').children('th')
      .filter(function() {
        return $(this).text() === AGE_RATINGS;
      }).parent().children('td');
    const ageRatingsText = ageRatingsElement.text();
    switch (language) {
      case 'ja-jp':
        if (ageRatingsText.indexOf('全年齢') !== -1) {
          work.age_ratings = 'G'
        } else if (ageRatingsText.indexOf('R-15') !== -1) {
          work.age_ratings = 'R15'
        } else if (ageRatingsText.indexOf('18禁') !== -1) {
          work.age_ratings = 'R18'
        }
        break;
      case 'zh-tw':
        if (ageRatingsText.indexOf('全年齢') !== -1) {
          work.age_ratings = 'G'
        } else if (ageRatingsText.indexOf('R-15') !== -1) {
          work.age_ratings = 'R15'
        } else if (ageRatingsText.indexOf('18禁') !== -1) {
          work.age_ratings = 'R18'
        }
        break;
      default:
        if (ageRatingsText.indexOf('全年龄') !== -1) {
          work.age_ratings = 'G'
        } else if (ageRatingsText.indexOf('R-15') !== -1) {
          work.age_ratings = 'R15'
        } else if (ageRatingsText.indexOf('18禁') !== -1) {
          work.age_ratings = 'R18'
        }
    }
    if (!work.age_ratings) {
      throw new Error('解析[年龄指定]失败.');
    }
    
    // 贩卖日 (YYYY-MM-DD)
    const releaseElement = $('#work_outline').children('tbody').children('tr').children('th')
      .filter(function() {
        return $(this).text() === RELEASE;
      }).parent().children('td');
    const releaseText = releaseElement.text();
    const release = releaseText.replace(/[^0-9]/ig, '');
    if (release.length >= 8) {
      work.release = `${release.slice(0, 4)}-${release.slice(4, 6)}-${release.slice(6, 8)}`;
    } else {
      throw new Error('解析[贩卖日]失败.');
    }
    
    // 系列
    const seriesElement = $('#work_outline').children('tbody').children('tr').children('th')
      .filter(function() {
        return $(this).text() === SERIES;
      }).parent().children('td').children('a');
    const seriesUrl = seriesElement.attr('href');
    const seriesName = seriesElement.text();
    const seriesId = seriesUrl && seriesUrl.match(/SRI(\d{10})/) && parseInt(seriesUrl.match(/SRI(\d{10})/)[1]);
    if (seriesId && seriesName) {
      work.series = {
        id: seriesId,
        name: seriesName
      };
    }
    
    // 标签
    const tagElements = $('#work_outline').children('tbody').children('tr').children('th')
      .filter(function() {
        return $(this).text() === GENRE;
      }).parent().children('td').children('div').children('a');
    tagElements.each(function() {
      const tagUrl = $(this).attr('href');
      const tagId = tagUrl && tagUrl.match(/genre\/(\d{3})/) && parseInt(tagUrl.match(/genre\/(\d{3})/)[1]);
      const tagName = $(this).text()
      if (tagId && tagName) {
        work.tags.push({
          id: tagId,
          name: tagName
        });
      }
    });
    
    // 声优
    const cvElements = $('#work_outline').children('tbody').children('tr').children('th')
      .filter(function() {
        return $(this).text() === VA;
      }).parent().children('td').children('a');
    cvElements.each(function() {
      const vaName = $(this).text();
      if (vaName) {
        work.vas.push({
          id: hashNameIntoInt(vaName),
          name: vaName
        });
      }
    });
  } catch (err) {
    throw new Error(`在解析 html 过程中出错: ${err.message}`);
  }

  if (work.vas.length === 0) {
    // 当在 DLsite 抓不到声优信息时, 从 HVDB 抓取声优信息
    const metadata = await scrapeWorkMetadataFromHVDB(id);
    if (metadata.vas.length <= 1) {
      // N/A
      work.vas = metadata.vas;
    } else {
      // 过滤掉英文的声优名
      metadata.vas.forEach(function(va) {
        if (!hasLetter(va.name)) {
          work.vas.push(va);
        }
      });
    }
  }

  return work;
};

/**
 * Requests dynamic work metadata from public DLsite API.
 * @param {number} id Work id.
 */
const scrapeWorkDynamicMetadata = async id => {
  const rjcode = (`000000${id}`).slice(-6);
  const url = `https://www.dlsite.com/maniax-touch/product/info/ajax?product_id=RJ${rjcode}`;

  let res = null;
  try {
    res = await axios.retryGet(url, { retry: {} });
  } catch (err) {
    if (err.response) {
      // 请求已发出，但服务器响应的状态码不在 2xx 范围内
      throw new Error(`Couldn't request work page HTML (${url}), received: ${err.response.status}.`);
    } else {
      throw err;
    }
  }

  const data = res.data[`RJ${rjcode}`];
  const work = {
    price: data.price, // 价格
    dl_count: data.dl_count, // 售出数
    rate_average: data.rate_average, // 平均评价
    rate_average_2dp: data.rate_average_2dp, // 平均评价
    rate_count: data.rate_count, // 评价数量
    rate_count_detail: data.rate_count_detail, // 评价分布明细
    review_count: data.review_count, // 评论数量
    rank: data.rank // 历史销售成绩
  };
  
  return work;
};

/**
 * Scrapes work metadata from public DLsite page HTML.
 * @param {number} id Work id.
 * @param {String} language 标签语言，'ja-jp', 'zh-tw' or 'zh-cn'，默认'zh-cn'
 */
const scrapeWorkMetadata = (id, language) => {
  return Promise.all([
    scrapeWorkStaticMetadata(id, language),
    scrapeWorkDynamicMetadata(id)
  ])
    .then(res => Object.assign(res[0], res[1]))
};

/**
 * 爬取 dlsite 的全部标签
 * @param {String} language 标签语言，'ja-jp', 'zh-tw' or 'zh-cn'，默认'zh-cn'
 */
const scrapeAllTags = async language => {
  const url = 'https://www.dlsite.com/maniax/fs';
  
  let COOKIE_LOCALE;
  switch (language) {
    case 'ja-jp':
      COOKIE_LOCALE = 'locale=ja-jp'
      break;
    case 'zh-tw':
      COOKIE_LOCALE = 'locale=zh-tw'
      break;
    default:
      COOKIE_LOCALE = 'locale=zh-cn'
  } 
 
  // 请求网页
  let res = null;
  try {
    res = await axios.retryGet(url, {
      retry: {},
      headers: { "cookie": COOKIE_LOCALE } // 自定义请求头
    });
  } catch (err) {
    if (err.response) {
      // 请求已发出，但服务器响应的状态码不在 2xx 范围内
      throw new Error(`Couldn't request work page HTML (${url}), received: ${err.response.status}.`);
    } else {
      throw err;
    }
  }

  // 解析 html
  const tags = {};
  try {
    const $ = cheerio.load(res.data);

    $('#fs_search').children('fieldset').eq(2)
      .children('table').children('tbody').children('tr').eq(1)
      .children('td').children('div')
      .children('div[class="frame_double_list_box list_triple_row"]')
      .each(function() {
        const tagCategory = $(this).children('div').children('dl').children('dt')
          .children('p').children('span').text();

        $(this).children('div').children('dl').children('dd')
          .each(function() {
            const tagElement = $(this).children('label');
            const tagId = tagElement.attr('for') && tagElement.attr('for').match(/genre_(\d{3})/) && parseInt(tagElement.attr('for').match(/genre_(\d{3})/)[1]);
            const tagName = tagElement.text();
            if (tagId && tagName && tagCategory) {
              tags[tagId] = {
                id: tagId,
                name: tagName,
                category: tagCategory
              };
            }
          });
      });
  } catch (err) {
    throw new Error(`在解析 html 过程中出错: ${err.message}`);
  }

  return tags;
};


module.exports = {
  scrapeAllTags,
  scrapeWorkMetadata,
  scrapeWorkDynamicMetadata
};
